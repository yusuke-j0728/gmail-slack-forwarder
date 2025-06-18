/**
 * Trigger Management Module
 * 
 * Handles creation, deletion, and management of time-based triggers for
 * the Gmail to Slack forwarding system.
 */

/**
 * Create time-based trigger for email processing
 * メール処理用の時間ベーストリガーを作成
 */
function createTrigger() {
  try {
    console.log('=== Setting up Email Processing Trigger ===');
    
    // Delete existing triggers first to avoid duplicates
    deleteExistingTriggers();
    
    // Create new trigger
    const trigger = ScriptApp.newTrigger('processEmails')
      .timeBased()
      .everyMinutes(CONFIG.TRIGGER_INTERVAL_MINUTES)
      .create();
    
    console.log(`✓ Trigger created successfully`);
    console.log(`  - Function: processEmails`);
    console.log(`  - Interval: ${CONFIG.TRIGGER_INTERVAL_MINUTES} minutes`);
    console.log(`  - Trigger ID: ${trigger.getUniqueId()}`);
    
    // Save trigger info to properties for tracking
    setProperty('TRIGGER_ID', trigger.getUniqueId());
    setProperty('TRIGGER_CREATED', new Date().toISOString());
    
    // Send confirmation to Slack
    try {
      sendTriggerNotification('created', CONFIG.TRIGGER_INTERVAL_MINUTES);
    } catch (error) {
      console.error('Failed to send trigger notification:', error);
      // Don't fail the whole setup for notification issues
    }
    
    console.log('Trigger setup completed successfully');
    
  } catch (error) {
    console.error('Error creating trigger:', error);
    throw error;
  }
}

/**
 * Delete all existing triggers for this script
 * このスクリプトの既存トリガーをすべて削除
 */
function deleteExistingTriggers() {
  try {
    console.log('Checking for existing triggers...');
    
    const triggers = ScriptApp.getProjectTriggers();
    let deletedCount = 0;
    
    triggers.forEach(trigger => {
      if (trigger.getHandlerFunction() === 'processEmails') {
        console.log(`Deleting existing trigger: ${trigger.getUniqueId()}`);
        ScriptApp.deleteTrigger(trigger);
        deletedCount++;
      }
    });
    
    if (deletedCount > 0) {
      console.log(`✓ Deleted ${deletedCount} existing triggers`);
    } else {
      console.log('✓ No existing triggers found');
    }
    
    // Clear trigger tracking properties
    try {
      PropertiesService.getScriptProperties().deleteProperty('TRIGGER_ID');
      PropertiesService.getScriptProperties().deleteProperty('TRIGGER_CREATED');
    } catch (error) {
      // Properties might not exist, that's fine
    }
    
  } catch (error) {
    console.error('Error deleting existing triggers:', error);
    throw error;
  }
}

/**
 * Get information about current triggers
 * 現在のトリガー情報を取得
 * 
 * @returns {Array} - Array of trigger info objects
 */
function getTriggerInfo() {
  try {
    const triggers = ScriptApp.getProjectTriggers();
    const triggerInfo = [];
    
    triggers.forEach(trigger => {
      if (trigger.getHandlerFunction() === 'processEmails') {
        triggerInfo.push({
          uniqueId: trigger.getUniqueId(),
          handlerFunction: trigger.getHandlerFunction(),
          triggerSource: trigger.getTriggerSource(),
          eventType: trigger.getEventType(),
          // Time-based trigger specific info
          intervalMinutes: CONFIG.TRIGGER_INTERVAL_MINUTES
        });
      }
    });
    
    return triggerInfo;
    
  } catch (error) {
    console.error('Error getting trigger info:', error);
    return [];
  }
}

/**
 * Disable all triggers without deleting them
 * トリガーを削除せずに無効化
 */
function disableTriggers() {
  try {
    console.log('Disabling email processing triggers...');
    
    const triggerInfo = getTriggerInfo();
    
    if (triggerInfo.length === 0) {
      console.log('No triggers to disable');
      return;
    }
    
    // Delete triggers (GAS doesn't have a disable function, only delete)
    deleteExistingTriggers();
    
    // Send notification
    try {
      sendTriggerNotification('disabled');
    } catch (error) {
      console.error('Failed to send trigger notification:', error);
    }
    
    console.log('✓ Triggers disabled successfully');
    
  } catch (error) {
    console.error('Error disabling triggers:', error);
    throw error;
  }
}

/**
 * Check trigger health and recreate if needed
 * トリガーの健全性をチェックし、必要に応じて再作成
 */
function checkTriggerHealth() {
  try {
    console.log('=== Checking Trigger Health ===');
    
    const triggers = getTriggerInfo();
    
    if (triggers.length === 0) {
      console.log('⚠️ No active triggers found. Recreating...');
      createTrigger();
      return;
    }
    
    if (triggers.length > 1) {
      console.log(`⚠️ Found ${triggers.length} triggers. Cleaning up duplicates...`);
      deleteExistingTriggers();
      createTrigger();
      return;
    }
    
    console.log('✅ Trigger health check passed');
    console.log(`   Active triggers: ${triggers.length}`);
    console.log(`   Interval: ${CONFIG.TRIGGER_INTERVAL_MINUTES} minutes`);
    
    // Check last execution (would need to store this in properties)
    const lastExecution = PropertiesService.getScriptProperties().getProperty('LAST_EXECUTION');
    if (lastExecution) {
      const lastDate = new Date(lastExecution);
      const now = new Date();
      const minutesSince = Math.floor((now - lastDate) / (1000 * 60));
      console.log(`   Last execution: ${minutesSince} minutes ago`);
      
      // Alert if no execution for too long
      if (minutesSince > CONFIG.TRIGGER_INTERVAL_MINUTES * 3) {
        console.log('⚠️ Warning: Long time since last execution');
      }
    }
    
  } catch (error) {
    console.error('Error checking trigger health:', error);
    throw error;
  }
}

/**
 * Send trigger status notification to Slack
 * トリガー状態の通知をSlackに送信
 * 
 * @param {string} action - Action performed (created, disabled, etc.)
 * @param {number} interval - Trigger interval in minutes (optional)
 */
function sendTriggerNotification(action, interval = null) {
  try {
    const webhookUrl = getProperty(PROPERTY_KEYS.SLACK_WEBHOOK_URL);
    
    let title, emoji, color;
    
    switch (action) {
      case 'created':
        title = '⚡ メール監視トリガーが有効化されました';
        emoji = ':white_check_mark:';
        color = 'good';
        break;
      case 'disabled':
        title = '⏸️ メール監視トリガーが無効化されました';
        emoji = ':warning:';
        color = 'warning';
        break;
      default:
        title = `📋 トリガー状態: ${action}`;
        emoji = ':information_source:';
        color = '#439FE0';
    }
    
    const fields = [
      {
        title: 'システム状態',
        value: action === 'created' ? '🟢 監視中' : '🔴 停止中',
        short: true
      },
      {
        title: '更新時刻',
        value: Utilities.formatDate(new Date(), 'JST', 'yyyy/MM/dd HH:mm:ss'),
        short: true
      }
    ];
    
    if (interval) {
      fields.push({
        title: 'チェック間隔',
        value: `${interval}分`,
        short: true
      });
    }
    
    const message = {
      channel: CONFIG.SLACK_CHANNEL,
      username: 'Gmail Bot',
      icon_emoji: emoji,
      attachments: [{
        color: color,
        title: title,
        fields: fields,
        footer: 'Gmail to Slack Forwarder - Trigger Manager'
      }]
    };
    
    UrlFetchApp.fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      payload: JSON.stringify(message),
      muteHttpExceptions: true
    });
    
    console.log('✓ Trigger notification sent to Slack');
    
  } catch (error) {
    console.error('Error sending trigger notification:', error);
    // Don't throw - this is not critical
  }
}

/**
 * Update last execution timestamp
 * 最終実行タイムスタンプを更新
 */
function updateLastExecution() {
  try {
    const now = new Date().toISOString();
    setProperty('LAST_EXECUTION', now);
  } catch (error) {
    console.error('Error updating last execution timestamp:', error);
    // Don't throw - this is not critical
  }
}

/**
 * Test function for trigger operations
 * トリガー操作のテスト関数
 */
function testTriggerOperations() {
  console.log('=== TESTING Trigger Operations ===');
  
  try {
    // Test getting current trigger info
    const initialTriggers = getTriggerInfo();
    console.log(`✓ Current triggers: ${initialTriggers.length}`);
    
    // Test trigger health check
    checkTriggerHealth();
    console.log('✓ Trigger health check completed');
    
    // Test getting trigger info after health check
    const finalTriggers = getTriggerInfo();
    console.log(`✓ Final triggers: ${finalTriggers.length}`);
    
    if (finalTriggers.length === 1) {
      console.log('✅ Exactly one trigger active - optimal state');
    }
    
    console.log('Trigger operations test completed successfully');
    
  } catch (error) {
    console.error('Trigger operations test failed:', error);
    throw error;
  }
}

/**
 * Manual trigger setup function (for initial setup)
 * 手動トリガーセットアップ関数（初期設定用）
 */
function setupInitialTrigger() {
  console.log('=== INITIAL TRIGGER SETUP ===');
  
  try {
    // Validate configuration first
    validateConfiguration();
    
    // Create trigger
    createTrigger();
    
    // Test trigger health
    checkTriggerHealth();
    
    console.log('✅ Initial trigger setup completed successfully');
    console.log('The system will now monitor Gmail every', CONFIG.TRIGGER_INTERVAL_MINUTES, 'minutes');
    
  } catch (error) {
    console.error('Initial trigger setup failed:', error);
    throw error;
  }
}