/**
 * Gmail to Slack Forwarder - Main Configuration and Entry Point
 * 
 * This file contains the main configuration and entry point for the Gmail to Slack forwarding system.
 * It monitors specific email addresses, processes attachments, and sends notifications to Slack.
 */

// === CONFIGURATION ===
const CONFIG = {
  // Email monitoring settings
  // IMPORTANT: Set actual sender email in Script Properties, not here!
  SENDER_EMAIL: getProperty('SENDER_EMAIL') || 'example@domain.com',  // 監視対象のメールアドレス
  
  // Subject pattern matching configuration
  // 件名パターンマッチング設定
  SUBJECT_PATTERNS: {
    // Enable multiple pattern matching
    ENABLE_MULTIPLE_PATTERNS: true,
    
    // Pattern matching mode: 'any' (match any pattern) or 'all' (match all patterns)
    MATCH_MODE: 'any',
    
    // Define multiple patterns for different email types
    PATTERNS: [
      // newsletter pattern
      /.*お知らせ.*PR/,
      
      // Event notification patterns with date/time
      /【.*】第\d+回.*部会/,
      /.*第\d+回.*部会/,
      
      // Study session patterns
      /.*勉強会/,
      
    ]
  },
  
  // Legacy single pattern support (for backward compatibility)
  SUBJECT_PATTERN: /第\d+回.*部会.*開催.*案内|.*メルマガ.*|.*勉強会.*/,
  
  GMAIL_LABEL: 'Processed',  // 処理済みメールのラベル名
  
  // Slack integration settings
  // IMPORTANT: Set actual Slack channel in Script Properties, not here!
  SLACK_CHANNEL: getProperty('SLACK_CHANNEL') || '#general',  // 通知先Slackチャンネル
  
  // Google Drive settings  
  DRIVE_FOLDER_NAME: 'Gmail Attachments',  // 添付ファイル保存フォルダ名
  
  // Processing settings
  MAX_EMAILS_PER_RUN: 10,  // 一回の実行で処理する最大メール数
  BODY_PREVIEW_LENGTH: 20000,  // Slackに表示する本文の最大文字数（増やして全文表示可能に）
  SHOW_FULL_EMAIL_BODY: true,  // true: 全文表示（制限内）, false: 短縮表示
  SEND_DRIVE_FOLDER_NOTIFICATION: true,  // true: PDF保存後にDriveフォルダリンクをフォローアップ送信
  
  // Trigger settings
  TRIGGER_INTERVAL_MINUTES: 5  // トリガーの実行間隔（分）
};

// === SCRIPT PROPERTIES KEYS ===
// All sensitive configuration should be stored in Script Properties, not in code!
const PROPERTY_KEYS = {
  // Required properties (must be set in Script Properties)
  SLACK_WEBHOOK_URL: 'SLACK_WEBHOOK_URL',
  SENDER_EMAIL: 'SENDER_EMAIL',
  SLACK_CHANNEL: 'SLACK_CHANNEL',
  
  // Optional properties (auto-generated if not set)
  DRIVE_FOLDER_ID: 'DRIVE_FOLDER_ID',
  
  // Slack Web API properties (optional - for thread support)
  SLACK_BOT_TOKEN: 'SLACK_BOT_TOKEN',
  USE_SLACK_API: 'USE_SLACK_API'  // Set to 'true' to use Web API instead of webhook
};

/**
 * Main processing function - called by time-based trigger
 * メイン処理関数 - 時間ベーストリガーから呼び出される
 */
function processEmails() {
  const startTime = new Date().getTime();
  
  try {
    console.log('=== Gmail to Slack Forwarder Starting ===');
    console.log(`Configuration: Sender=${CONFIG.SENDER_EMAIL}, Pattern=${CONFIG.SUBJECT_PATTERN}`);
    
    // Check required properties
    validateConfiguration();
    
    // Search for emails from sender (including those in processed threads)
    // 送信者からのメールを検索（処理済みスレッド内のものも含む）
    const query = `from:${CONFIG.SENDER_EMAIL}`;
    const threads = GmailApp.search(query, 0, CONFIG.MAX_EMAILS_PER_RUN * 3); // Get more threads to check individual messages
    
    console.log(`Found ${threads.length} email threads`);
    
    if (threads.length === 0) {
      console.log('No emails to process');
      return;
    }
    
    let processedCount = 0;
    let errorCount = 0;
    let checkedCount = 0;
    
    // Process each thread and check individual messages
    threads.forEach((thread, index) => {
      try {
        console.log(`Checking thread ${index + 1}/${threads.length}: ${thread.getFirstMessageSubject()}`);
        
        // Check all messages in thread for unprocessed ones
        // スレッド内の全メッセージをチェックして未処理のものを検索
        const messages = thread.getMessages();
        let threadHasNewMessages = false;
        
        messages.forEach((message, msgIndex) => {
          try {
            checkedCount++;
            
            if (message.isInTrash()) {
              console.log(`  Message ${msgIndex + 1} is in trash, skipping`);
              return;
            }
            
            // Check if this specific message was already processed
            if (isMessageAlreadyProcessed(message)) {
              console.log(`  Message ${msgIndex + 1} already processed, skipping`);
              return;
            }
            
            console.log(`  Processing new message ${msgIndex + 1}: ${message.getSubject()}`);
            
            if (processMessage(message)) {
              processedCount++;
              threadHasNewMessages = true;
              
              // Mark this specific message as processed in spreadsheet
              markMessageProcessedInSheet(message);
            }
            
          } catch (msgError) {
            console.error(`Error processing message ${msgIndex + 1}:`, msgError);
            errorCount++;
          }
        });
        
        // Add thread label only if we processed new messages
        if (threadHasNewMessages) {
          addProcessedLabel(thread);
        }
        
      } catch (error) {
        console.error(`Error processing thread ${index + 1}:`, error);
        errorCount++;
      }
    });
    
    const endTime = new Date().getTime();
    const executionTime = endTime - startTime;
    
    console.log(`=== Processing Complete ===`);
    console.log(`Checked: ${checkedCount} messages, Processed: ${processedCount}, Errors: ${errorCount}, Time: ${executionTime}ms`);
    
    // Send summary notification if there were errors
    if (errorCount > 0) {
      sendErrorSummary(processedCount, errorCount, executionTime);
    }
    
  } catch (error) {
    console.error('Critical error in processEmails:', error);
    sendErrorNotification(`Critical error in Gmail forwarder: ${error.message}`);
    throw error;
  }
}

/**
 * Validate that all required configuration is present
 * 必要な設定がすべて存在することを確認
 */
function validateConfiguration() {
  console.log('Validating configuration...');
  
  // Check Slack webhook URL
  const webhookUrl = getProperty(PROPERTY_KEYS.SLACK_WEBHOOK_URL);
  if (!webhookUrl || !webhookUrl.startsWith('https://hooks.slack.com/')) {
    throw new Error('Invalid Slack webhook URL in script properties');
  }
  
  // Check or create Drive folder
  const folderId = getOrCreateDriveFolder();
  console.log(`Drive folder ID: ${folderId}`);
  
  console.log('Configuration validation complete');
}

/**
 * Get property from Script Properties with error handling
 * スクリプトプロパティから値を取得（エラーハンドリング付き）
 */
function getProperty(key, required = true) {
  try {
    const value = PropertiesService.getScriptProperties().getProperty(key);
    if (!value && required) {
      throw new Error(`Required property ${key} not found in script properties. Please set it using setProperty() or the setup functions.`);
    }
    return value;
  } catch (error) {
    if (required) {
      console.error(`Error getting required property ${key}:`, error);
      throw error;
    }
    return null;
  }
}

/**
 * Set property in Script Properties
 * スクリプトプロパティに値を設定
 */
function setProperty(key, value) {
  try {
    PropertiesService.getScriptProperties().setProperty(key, value);
    console.log(`Property ${key} set successfully`);
  } catch (error) {
    console.error(`Error setting property ${key}:`, error);
    throw error;
  }
}

/**
 * Get or create Google Drive folder for attachments
 * 添付ファイル用のGoogle Driveフォルダを取得または作成
 */
function getOrCreateDriveFolder() {
  try {
    // Try to get existing folder ID from properties
    let folderId;
    try {
      folderId = getProperty(PROPERTY_KEYS.DRIVE_FOLDER_ID);
      // Verify folder still exists
      DriveApp.getFolderById(folderId);
      return folderId;
    } catch (error) {
      console.log('Drive folder not found in properties or folder deleted, creating new one...');
    }
    
    // Search for existing folder by name
    const folders = DriveApp.getFoldersByName(CONFIG.DRIVE_FOLDER_NAME);
    if (folders.hasNext()) {
      const folder = folders.next();
      folderId = folder.getId();
      console.log(`Found existing Drive folder: ${CONFIG.DRIVE_FOLDER_NAME}`);
    } else {
      // Create new folder
      const folder = DriveApp.createFolder(CONFIG.DRIVE_FOLDER_NAME);
      folderId = folder.getId();
      console.log(`Created new Drive folder: ${CONFIG.DRIVE_FOLDER_NAME}`);
    }
    
    // Save folder ID to properties
    setProperty(PROPERTY_KEYS.DRIVE_FOLDER_ID, folderId);
    
    return folderId;
    
  } catch (error) {
    console.error('Error managing Drive folder:', error);
    throw error;
  }
}

/**
 * Mark individual message as processed using a custom label system
 * カスタムラベルシステムを使用して個別メッセージを処理済みとしてマーク
 * 
 * @param {GmailMessage} message - Gmail message to mark as processed
 * @deprecated Use markMessageProcessedInSheet from spreadsheetManager.js instead
 */
function markMessageAsProcessed(message) {
  try {
    // Now using spreadsheet for tracking
    console.log('Warning: markMessageAsProcessed is deprecated. Use markMessageProcessedInSheet instead.');
    // markMessageProcessedInSheet is defined in spreadsheetManager.js
    if (typeof markMessageProcessedInSheet === 'function') {
      markMessageProcessedInSheet(message);
    }
    
  } catch (error) {
    console.error('Error marking message as processed:', error);
    // Don't throw - this is not critical for main functionality
  }
}

/**
 * Cleanup old processed message records (optional maintenance)
 * 古い処理済みメッセージレコードのクリーンアップ（オプションのメンテナンス）
 * 
 * @param {number} _daysOld - Remove records older than this many days (unused)
 * @deprecated Cleanup is now handled automatically by spreadsheetManager.js
 */
function cleanupOldProcessedMessages(_daysOld = 30) {
  try {
    console.log('Note: Cleanup is now handled automatically by the spreadsheet manager.');
    // The spreadsheet manager handles cleanup automatically when row limit is exceeded
    return 0;
    
  } catch (error) {
    console.error('Error cleaning up old processed messages:', error);
    return 0;
  }
}

/**
 * Add processed label to email thread
 * メールスレッドに処理済みラベルを追加
 */
function addProcessedLabel(thread) {
  try {
    let label = GmailApp.getUserLabelByName(CONFIG.GMAIL_LABEL);
    if (!label) {
      label = GmailApp.createLabel(CONFIG.GMAIL_LABEL);
      console.log(`Created new Gmail label: ${CONFIG.GMAIL_LABEL}`);
    }
    thread.addLabel(label);
    console.log(`Added processed label to thread: ${thread.getFirstMessageSubject()}`);
  } catch (error) {
    console.error('Error adding processed label:', error);
    // Don't throw - this is not critical
  }
}

/**
 * Setup all required Script Properties
 * 必要なスクリプトプロパティをすべて設定
 */
function setupConfiguration() {
  console.log('=== Setting up Configuration ===');
  
  try {
    // Example setup - replace with actual values
    const config = {
      'SENDER_EMAIL': 'newsletter@company.com',
      'SLACK_WEBHOOK_URL': 'https://hooks.slack.com/services/TXXXXXXXX/BXXXXXXXX/your-webhook-key',
      'SLACK_CHANNEL': '#email-notifications'
    };
    
    Object.entries(config).forEach(([key, value]) => {
      setProperty(key, value);
      console.log(`Set ${key}: ${key === 'SLACK_WEBHOOK_URL' ? '[REDACTED]' : value}`);
    });
    
    console.log('✅ Configuration setup completed');
    console.log('⚠️  IMPORTANT: Update the values above with your actual configuration!');
    
  } catch (error) {
    console.error('Configuration setup failed:', error);
    throw error;
  }
}

/**
 * Display current configuration (safely, without exposing secrets)
 * 現在の設定を表示（機密情報を除く）
 */
function showConfiguration() {
  console.log('=== Current Configuration ===');
  
  try {
    const senderEmail = getProperty('SENDER_EMAIL', false);
    const slackChannel = getProperty('SLACK_CHANNEL', false);
    const webhookUrl = getProperty('SLACK_WEBHOOK_URL', false);
    const folderId = getProperty('DRIVE_FOLDER_ID', false);
    const spreadsheetId = getProperty('TRACKING_SPREADSHEET_ID', false);
    
    console.log(`Sender Email: ${senderEmail || 'NOT SET'}`);
    console.log(`Slack Channel: ${slackChannel || 'NOT SET'}`);
    console.log(`Webhook URL: ${webhookUrl ? '[SET]' : 'NOT SET'}`);
    console.log(`Drive Folder ID: ${folderId || 'NOT SET'}`);
    console.log(`Tracking Spreadsheet ID: ${spreadsheetId || 'NOT SET'}`);
    
    console.log(`\nPattern Settings:`);
    console.log(`Multiple patterns enabled: ${CONFIG.SUBJECT_PATTERNS?.ENABLE_MULTIPLE_PATTERNS}`);
    console.log(`Total patterns: ${CONFIG.SUBJECT_PATTERNS?.PATTERNS?.length || 0}`);
    
    // Show tracking stats if spreadsheet exists
    if (spreadsheetId) {
      try {
        const stats = getTrackingStats();
        if (stats) {
          console.log(`\nTracking Statistics:`);
          console.log(`Tracked messages: ${stats.messageCount}`);
          console.log(`Spreadsheet URL: ${stats.spreadsheetUrl}`);
        }
      } catch (error) {
        // Ignore errors in stats
      }
    }
    
  } catch (error) {
    console.error('Error showing configuration:', error);
  }
}

/**
 * Test function for manual execution
 * 手動実行用のテスト関数
 */
function testProcessEmails() {
  console.log('=== TESTING Email Processing ===');
  try {
    processEmails();
    console.log('Test completed successfully');
  } catch (error) {
    console.error('Test failed:', error);
    throw error;
  }
}

/**
 * Setup spreadsheet tracking system and migrate existing data
 * スプレッドシートトラッキングシステムの設定と既存データの移行
 */
function setupSpreadsheetTracking() {
  console.log('=== Setting up Spreadsheet Tracking System ===');
  
  try {
    // Step 1: Create or get the tracking spreadsheet
    console.log('Step 1: Creating/accessing tracking spreadsheet...');
    const spreadsheet = getOrCreateTrackingSpreadsheet();
    console.log(`✓ Spreadsheet ready: ${spreadsheet.getName()}`);
    console.log(`  URL: ${spreadsheet.getUrl()}`);
    
    // Step 2: Check for existing PROCESSED_MSG entries in Script Properties
    console.log('\nStep 2: Checking for existing processed messages in Script Properties...');
    const properties = PropertiesService.getScriptProperties().getProperties();
    const processedMessageCount = Object.keys(properties).filter(key => key.startsWith('PROCESSED_MSG_')).length;
    console.log(`Found ${processedMessageCount} processed messages in Script Properties`);
    
    // Step 3: Migrate if needed
    if (processedMessageCount > 0) {
      console.log('\nStep 3: Migrating existing data to spreadsheet...');
      migrateProcessedMessagesToSheet();
      
      // Optional: Ask user if they want to clean up Script Properties
      console.log('\n⚠️  Migration complete!');
      console.log('To free up Script Properties space, run: cleanupProcessedMessagesFromProperties()');
      console.log('This will remove all PROCESSED_MSG entries from Script Properties.');
    } else {
      console.log('\nNo migration needed - no existing processed messages found.');
    }
    
    // Step 4: Show final statistics
    console.log('\nStep 4: Final setup statistics:');
    const stats = getTrackingStats();
    if (stats) {
      console.log(`Total tracked messages: ${stats.messageCount}`);
      console.log(`Row limit: ${stats.rowLimit}`);
      console.log(`Oldest entry: ${stats.oldestDate || 'N/A'}`);
      console.log(`Newest entry: ${stats.newestDate || 'N/A'}`);
    }
    
    console.log('\n✅ Spreadsheet tracking system setup complete!');
    console.log('The system will now use the spreadsheet for tracking processed messages.');
    
  } catch (error) {
    console.error('Setup failed:', error);
    throw error;
  }
}