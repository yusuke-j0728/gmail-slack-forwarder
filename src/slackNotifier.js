/**
 * Slack Notification Module
 * 
 * Handles sending formatted notifications to Slack with email content and attachment information.
 * Supports rich formatting and error notifications.
 */

/**
 * Send email notification to Slack using Web API (with thread support)
 * Slack Web APIを使用してメール通知を送信（スレッドサポート付き）
 * 
 * @param {Object} emailData - Email data object
 * @returns {string|null} - Message timestamp for threading, or null if failed
 */
function sendSlackNotificationViaAPI(emailData) {
  const startTime = new Date().getTime();
  
  try {
    console.log('Preparing Slack notification via Web API...');
    const botToken = getProperty(PROPERTY_KEYS.SLACK_BOT_TOKEN, false);
    
    if (!botToken) {
      console.log('No bot token found, falling back to webhook method');
      return null;
    }
    
    const channel = CONFIG.SLACK_CHANNEL.replace('#', ''); // Remove # if present
    
    // Build attachment text
    const attachmentText = buildAttachmentText(emailData.attachments);
    
    // Build message for API
    const messageData = buildSlackMessage(emailData, attachmentText);
    
    // Convert to Web API format
    const apiPayload = {
      channel: channel,
      text: messageData.attachments[0].title,
      attachments: messageData.attachments,
      unfurl_links: false,
      unfurl_media: false
    };
    
    // Send via Web API
    const response = UrlFetchApp.fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${botToken}`,
        'Content-Type': 'application/json'
      },
      payload: JSON.stringify(apiPayload),
      muteHttpExceptions: true
    });
    
    const responseData = JSON.parse(response.getContentText());
    const endTime = new Date().getTime();
    const sendTime = endTime - startTime;
    
    if (responseData.ok) {
      console.log(`✓ Slack notification sent successfully via API (${sendTime}ms)`);
      console.log(`Message timestamp: ${responseData.ts}`);
      
      // Send additional messages for long email body if needed
      if (emailData.body && emailData.body.length > 1000) {
        console.log('Email body is long, sending additional messages in thread...');
        sendLongEmailBodyInThread(emailData.subject, emailData.body, emailData.date, channel, responseData.ts);
      }
      
      // Send follow-up message with Drive folder info if PDFs were saved
      if (CONFIG.SEND_DRIVE_FOLDER_NOTIFICATION) {
        const savedPdfAttachments = emailData.attachments.filter(att => 
          !att.error && !att.skipped && att.folderUrl
        );
        
        if (savedPdfAttachments.length > 0) {
          console.log(`Sending follow-up message for ${savedPdfAttachments.length} saved PDFs in thread...`);
          sendDriveFolderNotificationInThread(emailData.subject, savedPdfAttachments, emailData.date, channel, responseData.ts);
        }
      }
      
      return responseData.ts;
      
    } else {
      console.error(`✗ Slack API notification failed: ${responseData.error}`);
      return null;
    }
    
  } catch (error) {
    console.error('Error sending Slack notification via API:', error);
    return null;
  }
}

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
    // Check if we should use Web API instead of webhook
    const useAPI = getProperty(PROPERTY_KEYS.USE_SLACK_API, false) === 'true';
    if (useAPI) {
      const messageTs = sendSlackNotificationViaAPI(emailData);
      if (messageTs) {
        return; // Successfully sent via API
      }
      // Fall through to webhook method if API failed
    }
    console.log('Preparing Slack notification...');
    console.log(`Subject: ${emailData.subject}`);
    console.log(`Attachments: ${emailData.attachments.length}`);
    console.log(`Body length: ${emailData.body ? emailData.body.length : 0} characters`);
    
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
      
      // Try to extract timestamp from response for threading
      let messageTs = null;
      try {
        // Note: Webhook responses don't include ts, but we'll try anyway
        const responseData = JSON.parse(responseText);
        if (responseData.ts) {
          messageTs = responseData.ts;
          console.log(`Message timestamp: ${messageTs}`);
        }
      } catch (e) {
        // Webhook doesn't return message details, this is expected
        console.log('Note: Cannot get message timestamp from webhook response (this is normal)');
      }
      
      // Send additional messages for long email body if needed
      if (emailData.body && emailData.body.length > 1000) {
        console.log('Email body is long, sending additional messages...');
        sendLongEmailBody(emailData.subject, emailData.body, emailData.date);
      }
      
      // Send follow-up message with Drive folder info if PDFs were saved
      if (CONFIG.SEND_DRIVE_FOLDER_NOTIFICATION) {
        const savedPdfAttachments = emailData.attachments.filter(att => 
          !att.error && !att.skipped && att.folderUrl
        );
        
        if (savedPdfAttachments.length > 0) {
          console.log(`Sending follow-up message for ${savedPdfAttachments.length} saved PDFs...`);
          sendDriveFolderNotification(emailData.subject, savedPdfAttachments, emailData.date);
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
  
  // For long emails, show only a brief preview in main message
  let bodyPreview = emailData.body || '_本文なし_';
  const isLongBody = bodyPreview.length > 1000; // Much more conservative limit
  if (isLongBody) {
    // Show only the first 500 characters as preview
    bodyPreview = bodyPreview.substring(0, 500) + '\n\n_[本文の全文は続きのメッセージで表示されます]_';
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
          title: '📝 本文',
          value: bodyPreview,
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
 * @param {Date} emailDate - Email date for reference
 */
function sendDriveFolderNotification(emailSubject, savedAttachments, emailDate) {
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
    
    // Format reference to original message
    const dateStr = emailDate ? Utilities.formatDate(emailDate, 'JST', 'HH:mm') : '';
    const referenceText = dateStr ? `${dateStr}のメール` : '上記メール';
    
    const message = {
      channel: CONFIG.SLACK_CHANNEL,
      username: 'Gmail Bot',
      icon_emoji: ':file_folder:',
      text: `↳ ${referenceText}の添付ファイルをGoogle Driveに保存しました`,
      attachments: [{
        color: '#4CAF50',  // Green for success
        title: '📁 PDFファイル保存完了',
        text: `${fileCount}件のPDFファイルを保存しました\n\n${folderLinks}`,
        footer: `📧 ${emailSubject}`,
        ts: Math.floor(Date.now() / 1000)
      }],
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
 * Send long email body as additional messages
 * 長いメール本文を追加メッセージとして送信
 * 
 * @param {string} subject - Email subject for reference
 * @param {string} fullBody - Full email body text
 * @param {Date} emailDate - Email date for reference
 */
function sendLongEmailBody(subject, fullBody, emailDate) {
  try {
    console.log('Sending additional messages for long email body...');
    console.log(`Total body length: ${fullBody.length} characters`);
    
    const webhookUrl = getProperty(PROPERTY_KEYS.SLACK_WEBHOOK_URL);
    const chunkSize = 3500; // Safe size for Slack messages
    
    // Send the ENTIRE body text in chunks, starting from the beginning
    let remainingBody = fullBody;
    let partNumber = 1;
    let totalSent = 0;
    
    console.log(`Processing full body in chunks...`);
    
    while (remainingBody.length > 0) {
      const chunk = remainingBody.substring(0, Math.min(chunkSize, remainingBody.length));
      remainingBody = remainingBody.substring(chunk.length);
      
      console.log(`Sending part ${partNumber}: ${chunk.length} characters`);
      console.log(`Remaining after this part: ${remainingBody.length} characters`);
      
      const isLastPart = remainingBody.length === 0;
      const partText = isLastPart ? `（最終パート）` : `（パート ${partNumber}）`;
      
      // Format the continuation message with clear reference to the original
      const dateStr = emailDate ? Utilities.formatDate(emailDate, 'JST', 'HH:mm') : '';
      const referenceText = dateStr ? `${dateStr}のメール` : '上記メール';
      
      const message = {
        channel: CONFIG.SLACK_CHANNEL,
        username: 'Gmail Bot',
        icon_emoji: ':speech_balloon:',
        text: partNumber === 1 
          ? `↳ ${referenceText}の本文全文です` 
          : '',
        attachments: [{
          color: '#E0E0E0',  // Gray color for continuation
          title: `${partText}`,
          text: chunk,
          footer: `📧 ${subject}`,
          ts: Math.floor(Date.now() / 1000)
        }]
      };
      
      // Add a delay between messages to avoid rate limiting
      Utilities.sleep(1000);
      
      const response = UrlFetchApp.fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        payload: JSON.stringify(message),
        muteHttpExceptions: true
      });
      
      if (response.getResponseCode() !== 200) {
        console.error(`Failed to send body part ${partNumber}: ${response.getResponseCode()}`);
        console.error(`Response: ${response.getContentText()}`);
        break;
      }
      
      totalSent += chunk.length;
      partNumber++;
    }
    
    console.log(`✓ Sent ${partNumber - 1} additional message(s) for email body`);
    console.log(`Total characters sent: ${totalSent} / ${fullBody.length}`);
    
    if (totalSent === fullBody.length) {
      console.log('✅ All email content successfully sent to Slack');
    } else {
      console.warn(`⚠️ Some content may be missing: ${fullBody.length - totalSent} characters not sent`);
    }
    
  } catch (error) {
    console.error('Error sending long email body:', error);
    // Don't throw - this is an enhancement feature
  }
}

/**
 * Send long email body in thread using Web API
 * Web APIを使用してスレッドに長いメール本文を送信
 * 
 * @param {string} subject - Email subject for reference
 * @param {string} fullBody - Full email body text
 * @param {Date} emailDate - Email date for reference
 * @param {string} channel - Slack channel
 * @param {string} threadTs - Parent message timestamp
 */
function sendLongEmailBodyInThread(subject, fullBody, emailDate, channel, threadTs) {
  try {
    console.log('Sending email body in thread...');
    const botToken = getProperty(PROPERTY_KEYS.SLACK_BOT_TOKEN, false);
    
    if (!botToken) {
      console.log('No bot token, cannot send thread messages');
      return;
    }
    
    const chunkSize = 3500;
    let remainingBody = fullBody;
    let partNumber = 1;
    
    while (remainingBody.length > 0) {
      const chunk = remainingBody.substring(0, Math.min(chunkSize, remainingBody.length));
      remainingBody = remainingBody.substring(chunk.length);
      
      const isLastPart = remainingBody.length === 0;
      const partText = isLastPart ? `（最終パート）` : `（パート ${partNumber}）`;
      
      const payload = {
        channel: channel,
        thread_ts: threadTs,
        text: partNumber === 1 ? '📄 メール本文の全文' : '',
        attachments: [{
          color: '#E0E0E0',
          title: partText,
          text: chunk,
          footer: `📧 ${subject}`,
          ts: Math.floor(Date.now() / 1000)
        }]
      };
      
      const response = UrlFetchApp.fetch('https://slack.com/api/chat.postMessage', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${botToken}`,
          'Content-Type': 'application/json'
        },
        payload: JSON.stringify(payload),
        muteHttpExceptions: true
      });
      
      const responseData = JSON.parse(response.getContentText());
      if (!responseData.ok) {
        console.error(`Failed to send thread message: ${responseData.error}`);
        break;
      }
      
      partNumber++;
      Utilities.sleep(500); // Avoid rate limiting
    }
    
    console.log(`✓ Sent ${partNumber - 1} thread message(s) for email body`);
    
  } catch (error) {
    console.error('Error sending email body in thread:', error);
  }
}

/**
 * Send Drive folder notification in thread using Web API
 * Web APIを使用してスレッドにDriveフォルダ通知を送信
 * 
 * @param {string} emailSubject - Email subject for reference
 * @param {Array} savedAttachments - Array of successfully saved attachment info
 * @param {Date} emailDate - Email date for reference
 * @param {string} channel - Slack channel
 * @param {string} threadTs - Parent message timestamp
 */
function sendDriveFolderNotificationInThread(emailSubject, savedAttachments, emailDate, channel, threadTs) {
  try {
    console.log('Sending Drive folder notification in thread...');
    const botToken = getProperty(PROPERTY_KEYS.SLACK_BOT_TOKEN, false);
    
    if (!botToken) {
      console.log('No bot token, cannot send thread messages');
      return;
    }
    
    const uniqueFolders = [...new Map(
      savedAttachments
        .filter(att => att.folderUrl && att.folderPath)
        .map(att => [att.folderUrl, { url: att.folderUrl, path: att.folderPath }])
    ).values()];
    
    const folderLinks = uniqueFolders.map(folder => 
      `📁 <${folder.url}|${folder.path}>`
    ).join('\n');
    
    const fileCount = savedAttachments.length;
    
    const payload = {
      channel: channel,
      thread_ts: threadTs,
      text: '📁 PDFファイル保存完了',
      attachments: [{
        color: '#4CAF50',
        text: `${fileCount}件のPDFファイルを保存しました\n\n${folderLinks}`,
        footer: `📧 ${emailSubject}`,
        ts: Math.floor(Date.now() / 1000)
      }]
    };
    
    const response = UrlFetchApp.fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${botToken}`,
        'Content-Type': 'application/json'
      },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });
    
    const responseData = JSON.parse(response.getContentText());
    if (responseData.ok) {
      console.log('✓ Drive folder notification sent in thread');
    } else {
      console.error(`Failed to send Drive notification: ${responseData.error}`);
    }
    
  } catch (error) {
    console.error('Error sending Drive notification in thread:', error);
  }
}

/**
 * Test long email body splitting
 * 長いメール本文の分割をテスト
 */
function testLongEmailSplitting() {
  console.log('=== TESTING Long Email Body Splitting ===');
  
  try {
    // Create a test email with long body
    const longBody = `テスト件名: サンプルメール

こちらはテスト用のサンプルメールです。
システムの動作確認のために使用されます。

---------------------------------------------------
　サンプル情報セクション
---------------------------------------------------
●サンプル企業A、新サービス「テストサービス」をリリース
https://example.com/news/sample1
●サンプル企業B、新機能「サンプル機能」の提供を開始
https://example.com/news/sample2

●サンプル企業C、テストプロジェクトに関するお知らせ
https://example.com/news/sample3
●サンプル企業D、新しい取り組みについて
https://example.com/news/sample4

●サンプル企業E、システム改善に関する発表
https://example.com/news/sample5

●サンプル企業F、テストサービスの提供開始
https://example.com/news/sample6

---------------------------------------------------
　テスト情報セクション
---------------------------------------------------
●テスト機関における研究成果として新技術に関する研究報告書の公開
https://example.com/research/test1

●テスト庁、新制度に基づく情報提供について
https://example.com/gov/test1

●テスト機関、新基準の実施状況についての報告書の公表について
https://example.com/reports/test1

---------------------------------------------------
　事務局からのお知らせ
---------------------------------------------------
●テストイベントの開催日時決定のお知らせ
テストイベントの開催日時が決定しましたので、ご案内申し上げます。
開催日時：2025年12月1日（月）14：00開始
場所：テスト会場
対象：テスト参加者
主催：テスト運営事務局`;

    console.log(`Test body length: ${longBody.length} characters`);
    
    // Test the splitting logic
    const emailData = {
      subject: 'テストメルマガ／サンプル企業からのお知らせ',
      sender: 'test@example.com',
      date: new Date(),
      body: longBody,
      attachments: []
    };
    
    // Send the test notification
    sendSlackNotification(emailData);
    
    console.log('✓ Long email splitting test completed');
    
  } catch (error) {
    console.error('Long email splitting test failed:', error);
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
        folderPath: '2025-06-18_サンプルメルマガ',
        error: null,
        skipped: null
      },
      {
        originalName: 'document2.pdf', 
        folderUrl: 'https://drive.google.com/drive/folders/test123',
        folderPath: '2025-06-18_サンプルメルマガ',
        error: null,
        skipped: null
      }
    ];
    
    console.log('✓ Testing Drive folder notification...');
    sendDriveFolderNotification('サンプル組織からのお知らせメール', testDriveAttachments);
    console.log('✓ Drive folder notification test sent');
    
    console.log('Slack notifications test completed successfully');
    
  } catch (error) {
    console.error('Slack notifications test failed:', error);
    throw error;
  }
}