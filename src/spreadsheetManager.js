/**
 * Spreadsheet Manager Module
 * 
 * Handles tracking of processed messages in Google Sheets instead of Script Properties
 * to avoid storage limitations and provide better data management.
 */

// Spreadsheet configuration
const SPREADSHEET_CONFIG = {
  SPREADSHEET_NAME: 'Gmail Slack Forwarder - Processed Messages',
  SHEET_NAME: 'ProcessedMessages',
  HEADERS: ['Message ID', 'Subject', 'Sender', 'Processed Date', 'Timestamp'],
  MAX_ROWS: 10000, // Keep last 10,000 messages
  CLEANUP_BATCH_SIZE: 1000 // Delete this many rows at once when cleaning up
};

/**
 * Get or create the tracking spreadsheet
 * トラッキング用スプレッドシートを取得または作成
 * 
 * @returns {Spreadsheet} - Google Sheets spreadsheet object
 */
function getOrCreateTrackingSpreadsheet() {
  try {
    // Try to get spreadsheet ID from Script Properties
    let spreadsheetId = getProperty('TRACKING_SPREADSHEET_ID', false);
    
    if (spreadsheetId) {
      try {
        const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
        console.log(`Using existing tracking spreadsheet: ${spreadsheet.getName()}`);
        return spreadsheet;
      } catch (error) {
        console.log('Stored spreadsheet ID is invalid, creating new spreadsheet...');
      }
    }
    
    // Search for existing spreadsheet by name
    const files = DriveApp.getFilesByName(SPREADSHEET_CONFIG.SPREADSHEET_NAME);
    if (files.hasNext()) {
      const file = files.next();
      const spreadsheet = SpreadsheetApp.open(file);
      spreadsheetId = spreadsheet.getId();
      setProperty('TRACKING_SPREADSHEET_ID', spreadsheetId);
      console.log(`Found existing tracking spreadsheet: ${SPREADSHEET_CONFIG.SPREADSHEET_NAME}`);
      return spreadsheet;
    }
    
    // Create new spreadsheet
    console.log('Creating new tracking spreadsheet...');
    const spreadsheet = SpreadsheetApp.create(SPREADSHEET_CONFIG.SPREADSHEET_NAME);
    spreadsheetId = spreadsheet.getId();
    
    // Setup the sheet
    const sheet = spreadsheet.getActiveSheet();
    sheet.setName(SPREADSHEET_CONFIG.SHEET_NAME);
    
    // Add headers
    sheet.getRange(1, 1, 1, SPREADSHEET_CONFIG.HEADERS.length).setValues([SPREADSHEET_CONFIG.HEADERS]);
    sheet.getRange(1, 1, 1, SPREADSHEET_CONFIG.HEADERS.length).setFontWeight('bold');
    
    // Format the sheet
    sheet.setFrozenRows(1);
    sheet.autoResizeColumns(1, SPREADSHEET_CONFIG.HEADERS.length);
    
    // Save spreadsheet ID to Script Properties
    setProperty('TRACKING_SPREADSHEET_ID', spreadsheetId);
    
    console.log(`Created new tracking spreadsheet: ${SPREADSHEET_CONFIG.SPREADSHEET_NAME}`);
    console.log(`Spreadsheet URL: ${spreadsheet.getUrl()}`);
    
    return spreadsheet;
    
  } catch (error) {
    console.error('Error getting/creating tracking spreadsheet:', error);
    throw error;
  }
}

/**
 * Check if a message has been processed
 * メッセージが処理済みかどうかをチェック
 * 
 * @param {string} messageId - Gmail message ID
 * @returns {boolean} - true if message was already processed
 */
function isMessageProcessedInSheet(messageId) {
  try {
    const spreadsheet = getOrCreateTrackingSpreadsheet();
    const sheet = spreadsheet.getSheetByName(SPREADSHEET_CONFIG.SHEET_NAME);
    
    if (!sheet) {
      console.error('ProcessedMessages sheet not found');
      return false;
    }
    
    // Get all message IDs from the sheet
    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) {
      // No data rows, only header
      return false;
    }
    
    // Get message ID column (column 1)
    const messageIds = sheet.getRange(2, 1, lastRow - 1, 1).getValues().flat();
    
    // Check if message ID exists
    const isProcessed = messageIds.includes(messageId);
    
    if (isProcessed) {
      console.log(`Message ${messageId} found in tracking spreadsheet`);
    }
    
    return isProcessed;
    
  } catch (error) {
    console.error('Error checking message in spreadsheet:', error);
    // In case of error, assume not processed to avoid skipping messages
    return false;
  }
}

/**
 * Mark a message as processed in the spreadsheet
 * スプレッドシートでメッセージを処理済みとしてマーク
 * 
 * @param {GmailMessage} message - Gmail message object
 */
function markMessageProcessedInSheet(message) {
  try {
    const messageId = message.getId();
    const subject = message.getSubject();
    const sender = message.getFrom();
    const processedDate = new Date();
    const timestamp = processedDate.getTime();
    
    const spreadsheet = getOrCreateTrackingSpreadsheet();
    const sheet = spreadsheet.getSheetByName(SPREADSHEET_CONFIG.SHEET_NAME);
    
    if (!sheet) {
      throw new Error('ProcessedMessages sheet not found');
    }
    
    // Append new row
    sheet.appendRow([messageId, subject, sender, processedDate, timestamp]);
    
    console.log(`Marked message as processed in spreadsheet: ${messageId}`);
    
    // Check if cleanup is needed
    const rowCount = sheet.getLastRow();
    if (rowCount > SPREADSHEET_CONFIG.MAX_ROWS + SPREADSHEET_CONFIG.CLEANUP_BATCH_SIZE) {
      console.log(`Row count (${rowCount}) exceeds limit, triggering cleanup...`);
      cleanupOldEntriesInSheet();
    }
    
  } catch (error) {
    console.error('Error marking message as processed in spreadsheet:', error);
    // Don't throw - this is not critical for main functionality
  }
}

/**
 * Clean up old entries in the spreadsheet
 * スプレッドシートの古いエントリをクリーンアップ
 */
function cleanupOldEntriesInSheet() {
  try {
    const spreadsheet = getOrCreateTrackingSpreadsheet();
    const sheet = spreadsheet.getSheetByName(SPREADSHEET_CONFIG.SHEET_NAME);
    
    if (!sheet) {
      console.error('ProcessedMessages sheet not found');
      return;
    }
    
    const lastRow = sheet.getLastRow();
    const rowsToDelete = lastRow - SPREADSHEET_CONFIG.MAX_ROWS - 1; // -1 for header
    
    if (rowsToDelete <= 0) {
      console.log('No cleanup needed');
      return;
    }
    
    console.log(`Cleaning up ${rowsToDelete} old entries...`);
    
    // Delete old rows (keeping header)
    sheet.deleteRows(2, Math.min(rowsToDelete, SPREADSHEET_CONFIG.CLEANUP_BATCH_SIZE));
    
    console.log('Cleanup completed');
    
  } catch (error) {
    console.error('Error cleaning up old entries:', error);
    // Don't throw - cleanup is not critical
  }
}

/**
 * Migrate existing processed messages from Script Properties to Spreadsheet
 * Script Propertiesから既存の処理済みメッセージをスプレッドシートに移行
 */
function migrateProcessedMessagesToSheet() {
  try {
    console.log('=== Starting Migration to Spreadsheet ===');
    
    const properties = PropertiesService.getScriptProperties().getProperties();
    const processedMessages = [];
    
    // Collect all PROCESSED_MSG entries
    for (const [key, value] of Object.entries(properties)) {
      if (key.startsWith('PROCESSED_MSG_')) {
        const messageId = key.replace('PROCESSED_MSG_', '');
        const timestamp = parseInt(value);
        processedMessages.push({
          messageId: messageId,
          timestamp: timestamp
        });
      }
    }
    
    console.log(`Found ${processedMessages.length} processed messages to migrate`);
    
    if (processedMessages.length === 0) {
      console.log('No messages to migrate');
      return;
    }
    
    // Get or create spreadsheet
    const spreadsheet = getOrCreateTrackingSpreadsheet();
    const sheet = spreadsheet.getSheetByName(SPREADSHEET_CONFIG.SHEET_NAME);
    
    // Prepare data for batch insert
    const rows = processedMessages.map(msg => [
      msg.messageId,
      'Migrated from Script Properties', // Subject not available
      'Unknown', // Sender not available
      new Date(msg.timestamp),
      msg.timestamp
    ]);
    
    // Batch insert
    if (rows.length > 0) {
      const startRow = sheet.getLastRow() + 1;
      sheet.getRange(startRow, 1, rows.length, SPREADSHEET_CONFIG.HEADERS.length).setValues(rows);
      console.log(`Migrated ${rows.length} messages to spreadsheet`);
    }
    
    // Optional: Clean up Script Properties after migration
    console.log('Migration completed successfully');
    console.log(`Spreadsheet URL: ${spreadsheet.getUrl()}`);
    
  } catch (error) {
    console.error('Error during migration:', error);
    throw error;
  }
}

/**
 * Clean up PROCESSED_MSG entries from Script Properties after migration
 * 移行後にScript PropertiesからPROCESSED_MSGエントリをクリーンアップ
 */
function cleanupProcessedMessagesFromProperties() {
  try {
    console.log('=== Cleaning up Script Properties ===');
    
    const properties = PropertiesService.getScriptProperties().getProperties();
    let cleanedCount = 0;
    
    for (const key of Object.keys(properties)) {
      if (key.startsWith('PROCESSED_MSG_')) {
        PropertiesService.getScriptProperties().deleteProperty(key);
        cleanedCount++;
      }
    }
    
    console.log(`Cleaned up ${cleanedCount} PROCESSED_MSG entries from Script Properties`);
    return cleanedCount;
    
  } catch (error) {
    console.error('Error cleaning up Script Properties:', error);
    return 0;
  }
}

/**
 * Get tracking spreadsheet statistics
 * トラッキングスプレッドシートの統計情報を取得
 */
function getTrackingStats() {
  try {
    const spreadsheet = getOrCreateTrackingSpreadsheet();
    const sheet = spreadsheet.getSheetByName(SPREADSHEET_CONFIG.SHEET_NAME);
    
    if (!sheet) {
      return null;
    }
    
    const lastRow = sheet.getLastRow();
    const messageCount = Math.max(0, lastRow - 1); // Subtract header row
    
    let oldestDate = null;
    let newestDate = null;
    
    if (messageCount > 0) {
      // Get date range
      const dates = sheet.getRange(2, 4, messageCount, 1).getValues().flat();
      const validDates = dates.filter(d => d instanceof Date);
      
      if (validDates.length > 0) {
        oldestDate = new Date(Math.min(...validDates.map(d => d.getTime())));
        newestDate = new Date(Math.max(...validDates.map(d => d.getTime())));
      }
    }
    
    return {
      spreadsheetName: spreadsheet.getName(),
      spreadsheetUrl: spreadsheet.getUrl(),
      messageCount: messageCount,
      oldestDate: oldestDate,
      newestDate: newestDate,
      rowLimit: SPREADSHEET_CONFIG.MAX_ROWS
    };
    
  } catch (error) {
    console.error('Error getting tracking stats:', error);
    return null;
  }
}

/**
 * Test function for spreadsheet operations
 * スプレッドシート操作のテスト関数
 */
function testSpreadsheetOperations() {
  console.log('=== TESTING Spreadsheet Operations ===');
  
  try {
    // Test spreadsheet creation/access
    const spreadsheet = getOrCreateTrackingSpreadsheet();
    console.log('✓ Spreadsheet accessible:', spreadsheet.getName());
    console.log('  URL:', spreadsheet.getUrl());
    
    // Test checking if message is processed
    const testMessageId = 'test_message_' + new Date().getTime();
    const isProcessed = isMessageProcessedInSheet(testMessageId);
    console.log('✓ Check non-existent message:', !isProcessed);
    
    // Test marking message as processed
    const mockMessage = {
      getId: () => testMessageId,
      getSubject: () => 'Test Subject',
      getFrom: () => 'test@example.com'
    };
    
    markMessageProcessedInSheet(mockMessage);
    console.log('✓ Message marked as processed');
    
    // Test if message is now processed
    const isNowProcessed = isMessageProcessedInSheet(testMessageId);
    console.log('✓ Check processed message:', isNowProcessed);
    
    // Test getting stats
    const stats = getTrackingStats();
    console.log('✓ Tracking stats:', JSON.stringify(stats, null, 2));
    
    console.log('Spreadsheet operations test completed successfully');
    
  } catch (error) {
    console.error('Spreadsheet operations test failed:', error);
    throw error;
  }
}