/**
 * Slack Notification Module
 * 
 * Handles sending formatted notifications to Slack with email content and attachment information.
 * Supports rich formatting and error notifications.
 */

/**
 * Send email notification to Slack
 * メール通知をSlackに送信
 * 
 * @param {Object} emailData - Email data object
 * @param {string} emailData.subject - Email subject
 * @param {string} emailData.sender - Email sender
 * @param {Date} emailData.date - Email date
 * @param {string} emailData.body - Email body (truncated)
 * @param {Array} emailData.attachments - Attachment info array
 */
function sendSlackNotification(emailData) {
  const startTime = new Date().getTime();
  
  try {
    console.log('Preparing Slack notification...');
    console.log(`Subject: ${emailData.subject}`);
    console.log(`Attachments: ${emailData.attachments.length}`);
    
    const webhookUrl = getProperty(PROPERTY_KEYS.SLACK_WEBHOOK_URL);
    
    // Build attachment text
    const attachmentText = buildAttachmentText(emailData.attachments);
    
    // Build main message
    const message = buildSlackMessage(emailData, attachmentText);
    
    // Send to Slack
    const response = UrlFetchApp.fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      payload: JSON.stringify(message),
      muteHttpExceptions: true
    });
    
    const responseCode = response.getResponseCode();
    const responseText = response.getContentText();
    
    const endTime = new Date().getTime();
    const sendTime = endTime - startTime;
    
    if (responseCode === 200) {
      console.log(`✓ Slack notification sent successfully (${sendTime}ms)`);
      
      // Send follow-up message with Drive folder info if PDFs were saved
      if (CONFIG.SEND_DRIVE_FOLDER_NOTIFICATION) {
        const savedPdfAttachments = emailData.attachments.filter(att => 
          !att.error && !att.skipped && att.folderUrl
        );
        
        if (savedPdfAttachments.length > 0) {
          console.log(`Sending follow-up message for ${savedPdfAttachments.length} saved PDFs...`);
          sendDriveFolderNotification(emailData.subject, savedPdfAttachments);
        }
      }
      
    } else {
      console.error(`✗ Slack notification failed: ${responseCode} - ${responseText}`);
      throw new Error(`Slack API error: ${responseCode} - ${responseText}`);
    }
    
  } catch (error) {
    console.error('Error sending Slack notification:', error);
    throw error;
  }
}

/**
 * Build formatted attachment text for Slack
 * Slack用のフォーマットされた添付ファイルテキストを構築
 * 
 * @param {Array} attachments - Attachment info array
 * @returns {string} - Formatted attachment text
 */
function buildAttachmentText(attachments) {
  if (attachments.length === 0) {
    return 'なし';
  }
  
  const attachmentLines = attachments.map(att => {
    if (att.error) {
      return `• ❌ ${att.originalName} (${formatFileSize(att.size)}) - 保存失敗: ${att.error}`;
    } else if (att.skipped) {
      return `• ⚠️ ${att.originalName} (${formatFileSize(att.size)}) - スキップ: ${att.skipped}`;
    } else {
      // Include folder information if available
      const folderInfo = att.folderPath ? ` in ${att.folderPath}` : '';
      const folderLink = att.folderUrl ? ` | <${att.folderUrl}|📁 Folder>` : '';
      return `• ✅ ${att.originalName} (${formatFileSize(att.size)})${folderInfo} - <${att.driveUrl}|📄 File>${folderLink}`;
    }
  });
  
  return attachmentLines.join('\n');
}

/**
 * Build complete Slack message object
 * 完全なSlackメッセージオブジェクトを構築
 * 
 * @param {Object} emailData - Email data
 * @param {string} attachmentText - Formatted attachment text
 * @returns {Object} - Slack message object
 */
function buildSlackMessage(emailData, attachmentText) {
  const messageColor = emailData.attachments.some(att => att.error) ? 'warning' : 'good';
  
  const successfulAttachments = emailData.attachments.filter(att => !att.error && !att.skipped).length;
  const skippedAttachments = emailData.attachments.filter(att => att.skipped).length;
  const totalAttachments = emailData.attachments.length;
  
  // Build attachment count display
  let attachmentCountText = `${successfulAttachments}/${totalAttachments}件`;
  if (skippedAttachments > 0) {
    attachmentCountText += ` (${skippedAttachments}件スキップ)`;
  }
  
  return {
    channel: CONFIG.SLACK_CHANNEL,
    username: 'Gmail Bot',
    icon_emoji: ':email:',
    attachments: [{
      color: messageColor,
      title: `📧 新着メール: ${emailData.subject}`,
      title_link: `mailto:${emailData.sender}`,
      fields: [
        {
          title: '👤 送信者',
          value: emailData.sender,
          short: true
        },
        {
          title: '📅 受信日時',
          value: Utilities.formatDate(emailData.date, 'JST', 'yyyy/MM/dd HH:mm:ss'),
          short: true
        },
        {
          title: '📝 本文（抜粋）',
          value: emailData.body || '_本文なし_',
          short: false
        },
        {
          title: `📎 添付ファイル (${attachmentCountText})`,
          value: attachmentText,
          short: false
        }
      ],
      footer: 'Gmail to Slack Forwarder',
      footer_icon: 'https://ssl.gstatic.com/ui/v1/icons/mail/images/favicon2.ico',
      ts: Math.floor(emailData.date.getTime() / 1000)
    }]
  };
}

/**
 * Send error notification to Slack
 * エラー通知をSlackに送信
 * 
 * @param {string} errorMessage - Error message to send
 */
function sendErrorNotification(errorMessage) {
  try {
    console.log('Sending error notification to Slack...');
    
    const webhookUrl = getProperty(PROPERTY_KEYS.SLACK_WEBHOOK_URL);
    
    const message = {
      channel: CONFIG.SLACK_CHANNEL,
      username: 'Gmail Bot',
      icon_emoji: ':warning:',
      attachments: [{
        color: 'danger',
        title: '🚨 Gmail転送システムエラー',
        text: `\`\`\`${errorMessage}\`\`\``,
        fields: [
          {
            title: '発生時刻',
            value: Utilities.formatDate(new Date(), 'JST', 'yyyy/MM/dd HH:mm:ss'),
            short: true
          }
        ],
        footer: 'Gmail to Slack Forwarder - Error Handler'
      }]
    };
    
    const response = UrlFetchApp.fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      payload: JSON.stringify(message),
      muteHttpExceptions: true
    });
    
    const responseCode = response.getResponseCode();
    if (responseCode === 200) {
      console.log('✓ Error notification sent to Slack');
    } else {
      console.error(`✗ Failed to send error notification: ${responseCode}`);
    }
    
  } catch (error) {
    console.error('Failed to send error notification:', error);
    // Don't throw here to avoid infinite error loops
  }
}

/**
 * Send processing summary notification
 * 処理サマリー通知を送信
 * 
 * @param {number} processedCount - Number of successfully processed emails
 * @param {number} errorCount - Number of emails with errors
 * @param {number} executionTime - Total execution time in ms
 */
function sendErrorSummary(processedCount, errorCount, executionTime) {
  try {
    console.log('Sending processing summary to Slack...');
    
    const webhookUrl = getProperty(PROPERTY_KEYS.SLACK_WEBHOOK_URL);
    
    const totalCount = processedCount + errorCount;
    const successRate = totalCount > 0 ? Math.round((processedCount / totalCount) * 100) : 100;
    
    const message = {
      channel: CONFIG.SLACK_CHANNEL,
      username: 'Gmail Bot',
      icon_emoji: ':bar_chart:',
      attachments: [{
        color: errorCount > 0 ? 'warning' : 'good',
        title: '📊 Gmail転送 処理サマリー',
        fields: [
          {
            title: '✅ 成功',
            value: `${processedCount}件`,
            short: true
          },
          {
            title: '❌ エラー',
            value: `${errorCount}件`,
            short: true
          },
          {
            title: '📈 成功率',
            value: `${successRate}%`,
            short: true
          },
          {
            title: '⏱️ 実行時間',
            value: `${(executionTime / 1000).toFixed(1)}秒`,
            short: true
          }
        ],
        footer: 'Gmail to Slack Forwarder - Summary',
        ts: Math.floor(Date.now() / 1000)
      }]
    };
    
    const response = UrlFetchApp.fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      payload: JSON.stringify(message),
      muteHttpExceptions: true
    });
    
    if (response.getResponseCode() === 200) {
      console.log('✓ Processing summary sent to Slack');
    }
    
  } catch (error) {
    console.error('Failed to send processing summary:', error);
  }
}

/**
 * Send Drive folder notification as a follow-up message
 * フォローアップメッセージとしてDriveフォルダ通知を送信
 * 
 * @param {string} emailSubject - Email subject for reference
 * @param {Array} savedAttachments - Array of successfully saved attachment info
 */
function sendDriveFolderNotification(emailSubject, savedAttachments) {
  try {
    console.log('Sending Drive folder follow-up notification...');
    
    const webhookUrl = getProperty(PROPERTY_KEYS.SLACK_WEBHOOK_URL);
    
    // Get unique folders (in case multiple files in same folder)
    const uniqueFolders = [...new Map(
      savedAttachments
        .filter(att => att.folderUrl && att.folderPath)
        .map(att => [att.folderUrl, { url: att.folderUrl, path: att.folderPath }])
    ).values()];
    
    if (uniqueFolders.length === 0) {
      console.log('No Drive folders to notify about');
      return;
    }
    
    // Build folder links
    const folderLinks = uniqueFolders.map(folder => 
      `📁 <${folder.url}|${folder.path}>`
    ).join('\n');
    
    const fileCount = savedAttachments.length;
    const folderCount = uniqueFolders.length;
    
    const message = {
      channel: CONFIG.SLACK_CHANNEL,
      username: 'Gmail Bot',
      icon_emoji: ':file_folder:',
      text: `📁 **PDFファイル保存完了**\n\n` +
            `件名: ${emailSubject}\n` +
            `保存数: ${fileCount}件のPDFファイル\n` +
            `フォルダ: ${folderCount}個\n\n` +
            `**🔗 Google Driveフォルダ:**\n${folderLinks}\n\n` +
            `_フォルダリンクをクリックしてPDFファイルにアクセスできます_`,
      unfurl_links: false,
      unfurl_media: false
    };
    
    // Add a small delay to ensure this appears after the main message
    Utilities.sleep(1000);
    
    const response = UrlFetchApp.fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      payload: JSON.stringify(message),
      muteHttpExceptions: true
    });
    
    const responseCode = response.getResponseCode();
    if (responseCode === 200) {
      console.log('✓ Drive folder notification sent successfully');
    } else {
      console.error(`✗ Drive folder notification failed: ${responseCode}`);
    }
    
  } catch (error) {
    console.error('Error sending Drive folder notification:', error);
    // Don't throw - this is a nice-to-have feature
  }
}

/**
 * Send test notification to verify Slack integration
 * Slack連携を確認するためのテスト通知を送信
 */
function sendTestNotification() {
  try {
    console.log('Sending test notification to Slack...');
    
    const webhookUrl = getProperty(PROPERTY_KEYS.SLACK_WEBHOOK_URL);
    
    const message = {
      channel: CONFIG.SLACK_CHANNEL,
      username: 'Gmail Bot',
      icon_emoji: ':test_tube:',
      attachments: [{
        color: 'good',
        title: '🧪 Gmail転送システム テスト通知',
        text: 'システムが正常に動作しています。',
        fields: [
          {
            title: 'テスト時刻',
            value: Utilities.formatDate(new Date(), 'JST', 'yyyy/MM/dd HH:mm:ss'),
            short: true
          },
          {
            title: 'ステータス',
            value: '✅ 正常',
            short: true
          }
        ],
        footer: 'Gmail to Slack Forwarder - Test'
      }]
    };
    
    const response = UrlFetchApp.fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      payload: JSON.stringify(message),
      muteHttpExceptions: true
    });
    
    const responseCode = response.getResponseCode();
    if (responseCode === 200) {
      console.log('✓ Test notification sent successfully');
      return true;
    } else {
      console.error(`✗ Test notification failed: ${responseCode}`);
      return false;
    }
    
  } catch (error) {
    console.error('Error sending test notification:', error);
    throw error;
  }
}

/**
 * Test function for Slack operations
 * Slack操作のテスト関数
 */
function testSlackNotifications() {
  console.log('=== TESTING Slack Notifications ===');
  
  try {
    // Test webhook URL validation
    const webhookUrl = getProperty(PROPERTY_KEYS.SLACK_WEBHOOK_URL);
    console.log('✓ Webhook URL retrieved from properties');
    
    if (!webhookUrl.startsWith('https://hooks.slack.com/')) {
      throw new Error('Invalid webhook URL format');
    }
    console.log('✓ Webhook URL format is valid');
    
    // Test attachment text building
    const testAttachments = [
      {
        originalName: 'test1.pdf',
        size: 1024000,
        driveUrl: 'https://drive.google.com/test1',
        error: null
      },
      {
        originalName: 'test2.docx',
        size: 512000,
        error: 'Upload failed'
      }
    ];
    
    const attachmentText = buildAttachmentText(testAttachments);
    console.log('✓ Attachment text built successfully');
    console.log(`   ${attachmentText.replace(/\n/g, '\\n   ')}`);
    
    // Send actual test notification
    const testSuccess = sendTestNotification();
    if (testSuccess) {
      console.log('✓ Test notification sent to Slack');
    } else {
      throw new Error('Test notification failed');
    }
    
    // Test Drive folder notification
    const testDriveAttachments = [
      {
        originalName: 'document1.pdf',
        folderUrl: 'https://drive.google.com/drive/folders/test123',
        folderPath: '2025-06-18_組織メルマガ',
        error: null,
        skipped: null
      },
      {
        originalName: 'document2.pdf', 
        folderUrl: 'https://drive.google.com/drive/folders/test123',
        folderPath: '2025-06-18_組織メルマガ',
        error: null,
        skipped: null
      }
    ];
    
    console.log('✓ Testing Drive folder notification...');
    sendDriveFolderNotification('組織からのお知らせメール', testDriveAttachments);
    console.log('✓ Drive folder notification test sent');
    
    console.log('Slack notifications test completed successfully');
    
  } catch (error) {
    console.error('Slack notifications test failed:', error);
    throw error;
  }
}