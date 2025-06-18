/**
 * Test Runner Module
 * 
 * Comprehensive testing functions for all system components.
 * Use these functions to verify system functionality before deploying to production.
 */

/**
 * Run all system tests
 * すべてのシステムテストを実行
 */
function runAllTests() {
  console.log('=== GMAIL SLACK FORWARDER - COMPREHENSIVE TEST SUITE ===');
  console.log(`Start time: ${Utilities.formatDate(new Date(), 'JST', 'yyyy/MM/dd HH:mm:ss')}`);
  
  const testResults = {
    configuration: false,
    messageProcessing: false,
    driveOperations: false,
    slackNotifications: false,
    triggerOperations: false,
    totalTests: 5,
    passedTests: 0,
    startTime: new Date().getTime()
  };
  
  try {
    // Test 1: Configuration validation
    console.log('\n1️⃣ Testing Configuration...');
    testConfiguration();
    testResults.configuration = true;
    testResults.passedTests++;
    console.log('✅ Configuration test PASSED');
    
  } catch (error) {
    console.error('❌ Configuration test FAILED:', error.message);
  }
  
  try {
    // Test 2: Message processing
    console.log('\n2️⃣ Testing Message Processing...');
    testMessageProcessing();
    testResults.messageProcessing = true;
    testResults.passedTests++;
    console.log('✅ Message processing test PASSED');
    
  } catch (error) {
    console.error('❌ Message processing test FAILED:', error.message);
  }
  
  try {
    // Test 3: Drive operations
    console.log('\n3️⃣ Testing Drive Operations...');
    testDriveOperations();
    testResults.driveOperations = true;
    testResults.passedTests++;
    console.log('✅ Drive operations test PASSED');
    
  } catch (error) {
    console.error('❌ Drive operations test FAILED:', error.message);
  }
  
  try {
    // Test 4: Slack notifications
    console.log('\n4️⃣ Testing Slack Notifications...');
    testSlackNotifications();
    testResults.slackNotifications = true;
    testResults.passedTests++;
    console.log('✅ Slack notifications test PASSED');
    
  } catch (error) {
    console.error('❌ Slack notifications test FAILED:', error.message);
  }
  
  try {
    // Test 5: Trigger operations
    console.log('\n5️⃣ Testing Trigger Operations...');
    testTriggerOperations();
    testResults.triggerOperations = true;
    testResults.passedTests++;
    console.log('✅ Trigger operations test PASSED');
    
  } catch (error) {
    console.error('❌ Trigger operations test FAILED:', error.message);
  }
  
  // Calculate results
  testResults.endTime = new Date().getTime();
  testResults.executionTime = testResults.endTime - testResults.startTime;
  testResults.successRate = Math.round((testResults.passedTests / testResults.totalTests) * 100);
  
  // Print summary
  printTestSummary(testResults);
  
  // Send test results to Slack
  try {
    sendTestResultsToSlack(testResults);
  } catch (error) {
    console.error('Failed to send test results to Slack:', error.message);
  }
  
  return testResults;
}

/**
 * Test configuration and setup
 * 設定とセットアップをテスト
 */
function testConfiguration() {
  console.log('Testing configuration validation...');
  
  // Test CONFIG object
  if (!CONFIG) {
    throw new Error('CONFIG object not found');
  }
  
  const requiredConfigKeys = [
    'SENDER_EMAIL',
    'SUBJECT_PATTERN',
    'GMAIL_LABEL',
    'SLACK_CHANNEL',
    'DRIVE_FOLDER_NAME'
  ];
  
  requiredConfigKeys.forEach(key => {
    if (!CONFIG[key]) {
      throw new Error(`Missing CONFIG.${key}`);
    }
  });
  
  console.log('✓ CONFIG object validation passed');
  
  // Test script properties
  try {
    const webhookUrl = getProperty(PROPERTY_KEYS.SLACK_WEBHOOK_URL);
    if (!webhookUrl.startsWith('https://hooks.slack.com/')) {
      throw new Error('Invalid Slack webhook URL format');
    }
    console.log('✓ Slack webhook URL validated');
  } catch (error) {
    throw new Error(`Slack webhook validation failed: ${error.message}`);
  }
  
  // Test Drive folder access
  try {
    const folderId = getOrCreateDriveFolder();
    const folder = DriveApp.getFolderById(folderId);
    console.log(`✓ Drive folder accessible: ${folder.getName()}`);
  } catch (error) {
    throw new Error(`Drive folder validation failed: ${error.message}`);
  }
  
  // Test Gmail label creation
  try {
    let label = GmailApp.getUserLabelByName(CONFIG.GMAIL_LABEL);
    if (!label) {
      label = GmailApp.createLabel(CONFIG.GMAIL_LABEL);
      console.log(`✓ Created Gmail label: ${CONFIG.GMAIL_LABEL}`);
    } else {
      console.log(`✓ Gmail label exists: ${CONFIG.GMAIL_LABEL}`);
    }
  } catch (error) {
    throw new Error(`Gmail label validation failed: ${error.message}`);
  }
}

/**
 * Test email search and pattern matching
 * メール検索とパターンマッチングをテスト
 */
function testEmailSearch() {
  console.log('=== TESTING Email Search ===');
  
  try {
    // Test Gmail search query
    const query = `from:${CONFIG.SENDER_EMAIL} -label:${CONFIG.GMAIL_LABEL}`;
    console.log(`Search query: ${query}`);
    
    const threads = GmailApp.search(query, 0, 5);
    console.log(`✓ Gmail search executed successfully`);
    console.log(`  Found ${threads.length} threads`);
    
    if (threads.length > 0) {
      console.log('Sample thread subjects:');
      threads.slice(0, 3).forEach((thread, index) => {
        const subject = thread.getFirstMessageSubject();
        const matches = CONFIG.SUBJECT_PATTERN.test(subject);
        console.log(`  ${index + 1}. "${subject}" - ${matches ? 'MATCHES' : 'NO MATCH'}`);
      });
    } else {
      console.log('⚠️ No emails found - this might be expected if no new emails exist');
    }
    
    console.log('Email search test completed successfully');
    
  } catch (error) {
    console.error('Email search test failed:', error);
    throw error;
  }
}

/**
 * Test end-to-end processing with sample data
 * サンプルデータでエンドツーエンド処理をテスト
 */
function testEndToEndProcessing() {
  console.log('=== TESTING End-to-End Processing ===');
  
  try {
    // Search for actual emails
    const query = `from:${CONFIG.SENDER_EMAIL} -label:${CONFIG.GMAIL_LABEL}`;
    const threads = GmailApp.search(query, 0, 1);
    
    if (threads.length === 0) {
      console.log('⚠️ No unprocessed emails found for end-to-end test');
      console.log('This is normal if all emails have been processed');
      return;
    }
    
    const thread = threads[0];
    const messages = thread.getMessages();
    
    if (messages.length === 0) {
      console.log('⚠️ No messages in thread');
      return;
    }
    
    const message = messages[0];
    const subject = message.getSubject();
    
    console.log(`Testing with email: "${subject}"`);
    
    // Test subject pattern matching
    const matches = CONFIG.SUBJECT_PATTERN.test(subject);
    console.log(`✓ Subject pattern test: ${matches ? 'MATCHES' : 'NO MATCH'}`);
    
    if (!matches) {
      console.log('ℹ️ Skipping processing test - subject pattern does not match');
      return;
    }
    
    // Test attachment processing (without actually saving)
    const attachments = message.getAttachments();
    console.log(`✓ Found ${attachments.length} attachments`);
    
    if (attachments.length > 0) {
      attachments.forEach((attachment, index) => {
        const safeFileName = generateSafeFilename(subject, index, attachment.getName());
        console.log(`  ${index + 1}. ${attachment.getName()} -> ${safeFileName}`);
      });
    }
    
    console.log('✅ End-to-end processing test completed');
    
  } catch (error) {
    console.error('End-to-end processing test failed:', error);
    throw error;
  }
}

/**
 * Print comprehensive test summary
 * 包括的なテストサマリーを出力
 * 
 * @param {Object} results - Test results object
 */
function printTestSummary(results) {
  console.log('\n' + '='.repeat(60));
  console.log('📊 TEST EXECUTION SUMMARY');
  console.log('='.repeat(60));
  
  console.log(`🕐 Execution Time: ${(results.executionTime / 1000).toFixed(1)} seconds`);
  console.log(`📈 Success Rate: ${results.successRate}% (${results.passedTests}/${results.totalTests})`);
  console.log('');
  
  console.log('📋 Individual Test Results:');
  console.log(`  Configuration:       ${results.configuration ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`  Message Processing:  ${results.messageProcessing ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`  Drive Operations:    ${results.driveOperations ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`  Slack Notifications: ${results.slackNotifications ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`  Trigger Operations:  ${results.triggerOperations ? '✅ PASS' : '❌ FAIL'}`);
  console.log('');
  
  if (results.successRate === 100) {
    console.log('🎉 ALL TESTS PASSED! System is ready for production use.');
  } else if (results.successRate >= 80) {
    console.log('⚠️ Most tests passed. Review failed tests before production deployment.');
  } else {
    console.log('🚨 Multiple test failures detected. System requires attention before deployment.');
  }
  
  console.log('='.repeat(60));
}

/**
 * Send test results to Slack
 * テスト結果をSlackに送信
 * 
 * @param {Object} results - Test results object
 */
function sendTestResultsToSlack(results) {
  try {
    const webhookUrl = getProperty(PROPERTY_KEYS.SLACK_WEBHOOK_URL);
    
    const emoji = results.successRate === 100 ? ':white_check_mark:' : 
                  results.successRate >= 80 ? ':warning:' : ':x:';
    
    const color = results.successRate === 100 ? 'good' :
                  results.successRate >= 80 ? 'warning' : 'danger';
    
    const message = {
      channel: CONFIG.SLACK_CHANNEL,
      username: 'Gmail Bot',
      icon_emoji: ':test_tube:',
      attachments: [{
        color: color,
        title: `${emoji} Gmail転送システム テスト結果`,
        fields: [
          {
            title: '成功率',
            value: `${results.successRate}% (${results.passedTests}/${results.totalTests})`,
            short: true
          },
          {
            title: '実行時間',
            value: `${(results.executionTime / 1000).toFixed(1)}秒`,
            short: true
          },
          {
            title: '設定テスト',
            value: results.configuration ? '✅' : '❌',
            short: true
          },
          {
            title: 'メール処理',
            value: results.messageProcessing ? '✅' : '❌',
            short: true
          },
          {
            title: 'Drive操作',
            value: results.driveOperations ? '✅' : '❌',
            short: true
          },
          {
            title: 'Slack通知',
            value: results.slackNotifications ? '✅' : '❌',
            short: true
          }
        ],
        footer: 'Gmail to Slack Forwarder - Test Suite',
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
      console.log('✓ Test results sent to Slack');
    } else {
      console.error(`✗ Failed to send test results: ${response.getResponseCode()}`);
    }
    
  } catch (error) {
    console.error('Error sending test results to Slack:', error);
    // Don't throw - this is not critical
  }
}

/**
 * Quick health check function
 * クイックヘルスチェック関数
 */
function quickHealthCheck() {
  console.log('=== QUICK HEALTH CHECK ===');
  
  try {
    // Check critical components only
    console.log('Checking Slack webhook...');
    const webhookUrl = getProperty(PROPERTY_KEYS.SLACK_WEBHOOK_URL);
    if (!webhookUrl.startsWith('https://hooks.slack.com/')) {
      throw new Error('Invalid webhook URL');
    }
    console.log('✓ Slack webhook OK');
    
    console.log('Checking Drive folder...');
    const folderId = getProperty(PROPERTY_KEYS.DRIVE_FOLDER_ID);
    DriveApp.getFolderById(folderId);
    console.log('✓ Drive folder OK');
    
    console.log('Checking Gmail access...');
    GmailApp.search('in:inbox', 0, 1);
    console.log('✓ Gmail access OK');
    
    console.log('Checking triggers...');
    const triggers = getTriggerInfo();
    console.log(`✓ Active triggers: ${triggers.length}`);
    
    console.log('✅ Health check PASSED - System operational');
    
  } catch (error) {
    console.error('❌ Health check FAILED:', error.message);
    throw error;
  }
}