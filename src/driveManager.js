/**
 * Google Drive Attachment Management Module
 * 
 * Handles saving email attachments to Google Drive with proper file organization
 * and error handling.
 */

/**
 * Process and save email attachments to Google Drive with organized folder structure
 * メール添付ファイルを整理されたフォルダ構造でGoogle Driveに保存
 * 
 * @param {Array} attachments - Array of Gmail attachment objects
 * @param {string} subject - Email subject for filename generation
 * @param {Date} emailDate - Email date for folder organization
 * @returns {Array} - Array of attachment info objects
 */
function processAttachments(attachments, subject, emailDate = new Date()) {
  console.log(`Processing ${attachments.length} attachments for subject: ${subject}`);
  
  if (attachments.length === 0) {
    return [];
  }
  
  const attachmentInfo = [];
  const baseFolderId = getProperty(PROPERTY_KEYS.DRIVE_FOLDER_ID);
  
  try {
    const baseFolder = DriveApp.getFolderById(baseFolderId);
    console.log(`Using base Drive folder: ${baseFolder.getName()} (ID: ${baseFolderId})`);
    console.log(`Base folder URL: ${baseFolder.getUrl()}`);
    
    // Create organized subfolder for this email
    const emailFolder = createEmailFolder(baseFolder, subject, emailDate);
    console.log(`Created/found email folder: ${emailFolder.getName()}`);
    console.log(`Email folder URL: ${emailFolder.getUrl()}`);
    console.log(`Email folder ID: ${emailFolder.getId()}`);
    
    attachments.forEach((attachment, index) => {
      try {
        console.log(`Processing attachment ${index + 1}/${attachments.length}: ${attachment.getName()}`);
        
        const info = saveAttachmentToDrive(attachment, subject, index, emailFolder);
        attachmentInfo.push(info);
        
        console.log(`Successfully saved: ${info.savedName}`);
        console.log(`File URL: ${info.driveUrl}`);
        console.log(`Saved in folder: ${info.folderPath}`);
        console.log(`Folder URL: ${info.folderUrl}`);
        
      } catch (error) {
        console.error(`Failed to save attachment ${index + 1} (${attachment.getName()}):`, error);
        
        // Add error info instead of skipping completely
        attachmentInfo.push({
          originalName: attachment.getName(),
          savedName: null,
          size: attachment.getSize(),
          driveUrl: null,
          fileId: null,
          folderPath: null,
          error: error.message
        });
      }
    });
    
    console.log(`Attachment processing complete. Saved: ${attachmentInfo.filter(info => !info.error).length}/${attachments.length}`);
    
  } catch (error) {
    console.error('Error accessing Drive folder:', error);
    throw new Error(`Drive folder access failed: ${error.message}`);
  }
  
  return attachmentInfo;
}

/**
 * Create organized email folder with date and subject
 * 日付と件名で整理されたメールフォルダを作成
 * 
 * @param {DriveFolder} baseFolder - Base folder for attachments
 * @param {string} subject - Email subject
 * @param {Date} emailDate - Email date
 * @returns {DriveFolder} - Created or existing email folder
 */
function createEmailFolder(baseFolder, subject, emailDate) {
  try {
    // Format date as YYYY-MM-DD
    const dateStr = Utilities.formatDate(emailDate, 'JST', 'yyyy-MM-dd');
    
    // Clean subject for folder name
    const cleanSubject = cleanSubjectForFolder(subject);
    
    // Create folder name: "YYYY-MM-DD_Subject"
    const folderName = `${dateStr}_${cleanSubject}`;
    
    console.log(`Creating email folder: ${folderName}`);
    console.log(`Date string: ${dateStr}`);
    console.log(`Clean subject: ${cleanSubject}`);
    console.log(`Full folder name: ${folderName}`);
    
    // Check if folder already exists
    const existingFolders = baseFolder.getFoldersByName(folderName);
    if (existingFolders.hasNext()) {
      const existingFolder = existingFolders.next();
      console.log(`Using existing folder: ${folderName}`);
      return existingFolder;
    }
    
    // Create new folder
    const emailFolder = baseFolder.createFolder(folderName);
    console.log(`Created new folder: ${folderName}`);
    console.log(`New folder URL: ${emailFolder.getUrl()}`);
    console.log(`New folder ID: ${emailFolder.getId()}`);
    
    return emailFolder;
    
  } catch (error) {
    console.error('Error creating email folder:', error);
    // Fallback to base folder if folder creation fails
    return baseFolder;
  }
}

/**
 * Clean email subject for use as folder name
 * メール件名をフォルダ名として使用できるようにクリーニング
 * 
 * @param {string} subject - Email subject
 * @returns {string} - Cleaned subject suitable for folder name
 */
function cleanSubjectForFolder(subject) {
  try {
    return subject
      // Remove or replace invalid characters for folder names
      .replace(/[<>:"/\\|?*]/g, '_')
      // Replace multiple spaces with single space
      .replace(/\s+/g, ' ')
      // Remove leading/trailing spaces
      .trim()
      // Limit length to avoid very long folder names
      .substring(0, 100)
      // Replace Japanese brackets that might cause issues
      .replace(/[【】]/g, '_')
      .replace(/[「」]/g, '_')
      // Replace forward slashes (common in subjects)
      .replace(/[／\/]/g, '_');
  } catch (error) {
    console.error('Error cleaning subject for folder:', error);
    // Fallback to timestamp if subject cleaning fails
    return `Email_${Utilities.formatDate(new Date(), 'JST', 'HHmmss')}`;
  }
}

/**
 * Save individual attachment to Google Drive
 * 個別の添付ファイルをGoogle Driveに保存
 * 
 * @param {GmailAttachment} attachment - Gmail attachment object
 * @param {string} subject - Email subject
 * @param {number} index - Attachment index
 * @param {DriveFolder} folder - Drive folder object
 * @returns {Object} - Attachment info object
 */
function saveAttachmentToDrive(attachment, subject, index, folder) {
  const startTime = new Date().getTime();
  
  try {
    const originalName = attachment.getName();
    const size = attachment.getSize();
    
    console.log(`Saving attachment: ${originalName} (${formatFileSize(size)})`);
    
    // Generate safe filename (simpler since we're in organized folder)
    const safeFileName = generateSimpleFilename(index, originalName);
    
    // Check for duplicate filenames
    const finalFileName = ensureUniqueFilename(folder, safeFileName);
    
    // Create file in Drive
    const blob = attachment.copyBlob().setName(finalFileName);
    const file = folder.createFile(blob);
    
    const endTime = new Date().getTime();
    const uploadTime = endTime - startTime;
    
    console.log(`Upload completed in ${uploadTime}ms`);
    
    return {
      originalName: originalName,
      savedName: finalFileName,
      size: size,
      driveUrl: file.getUrl(),
      fileId: file.getId(),
      folderPath: folder.getName(),
      folderUrl: folder.getUrl(),
      uploadTime: uploadTime
    };
    
  } catch (error) {
    console.error('Error saving attachment to Drive:', error);
    throw error;
  }
}

/**
 * Generate simple filename for organized folder structure
 * 整理されたフォルダ構造用のシンプルなファイル名を生成
 * 
 * @param {number} index - Attachment index
 * @param {string} originalName - Original filename
 * @returns {string} - Simple filename
 */
function generateSimpleFilename(index, originalName) {
  try {
    const timestamp = Utilities.formatDate(new Date(), 'JST', 'HHmmss');
    
    // For organized folders, use simpler naming
    if (originalName && originalName.trim()) {
      // Clean the original name
      const cleanName = originalName
        .replace(/[<>:"/\\|?*]/g, '_')
        .trim();
      
      // If multiple attachments, add index
      if (index > 0) {
        const nameParts = cleanName.split('.');
        const extension = nameParts.length > 1 ? `.${nameParts.pop()}` : '';
        const baseName = nameParts.join('.');
        return `${baseName}_${index + 1}${extension}`;
      }
      
      return cleanName;
    }
    
    // Fallback for unnamed attachments
    return `attachment_${index + 1}_${timestamp}`;
    
  } catch (error) {
    console.error('Error generating simple filename:', error);
    return `attachment_${index + 1}_${new Date().getTime()}`;
  }
}

/**
 * Ensure filename is unique in the Drive folder
 * Driveフォルダ内でファイル名が一意になることを保証
 * 
 * @param {DriveFolder} folder - Drive folder object
 * @param {string} fileName - Desired filename
 * @returns {string} - Unique filename
 */
function ensureUniqueFilename(folder, fileName) {
  try {
    const files = folder.getFilesByName(fileName);
    
    if (!files.hasNext()) {
      // No conflict, use original name
      return fileName;
    }
    
    // File exists, generate unique name
    const nameParts = fileName.split('.');
    const extension = nameParts.length > 1 ? `.${nameParts.pop()}` : '';
    const baseName = nameParts.join('.');
    
    let counter = 1;
    let uniqueName;
    
    do {
      uniqueName = `${baseName}_${counter}${extension}`;
      const conflictFiles = folder.getFilesByName(uniqueName);
      
      if (!conflictFiles.hasNext()) {
        break;
      }
      
      counter++;
    } while (counter < 100); // Safety limit
    
    console.log(`Generated unique filename: ${uniqueName}`);
    return uniqueName;
    
  } catch (error) {
    console.error('Error ensuring unique filename:', error);
    // Fallback to timestamp-based uniqueness
    const timestamp = new Date().getTime();
    return `${fileName}_${timestamp}`;
  }
}

/**
 * Format file size for human reading
 * ファイルサイズを人間が読める形式にフォーマット
 * 
 * @param {number} bytes - File size in bytes
 * @returns {string} - Formatted file size
 */
function formatFileSize(bytes) {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

/**
 * Get Drive folder usage statistics
 * Driveフォルダの使用状況統計を取得
 * 
 * @returns {Object} - Folder statistics
 */
function getDriveFolderStats() {
  try {
    const folderId = getProperty(PROPERTY_KEYS.DRIVE_FOLDER_ID);
    const folder = DriveApp.getFolderById(folderId);
    
    const files = folder.getFiles();
    let fileCount = 0;
    let totalSize = 0;
    
    while (files.hasNext()) {
      const file = files.next();
      fileCount++;
      totalSize += file.getSize();
    }
    
    return {
      folderName: folder.getName(),
      fileCount: fileCount,
      totalSize: totalSize,
      formattedSize: formatFileSize(totalSize),
      folderUrl: folder.getUrl()
    };
    
  } catch (error) {
    console.error('Error getting Drive folder stats:', error);
    return null;
  }
}

/**
 * Clean up old files in Drive folder (optional maintenance function)
 * Driveフォルダ内の古いファイルをクリーンアップ（オプションのメンテナンス関数）
 * 
 * @param {number} daysOld - Files older than this many days will be deleted
 * @returns {Object} - Cleanup results
 */
function cleanupOldFiles(daysOld = 90) {
  try {
    console.log(`Starting cleanup of files older than ${daysOld} days...`);
    
    const folderId = getProperty(PROPERTY_KEYS.DRIVE_FOLDER_ID);
    const folder = DriveApp.getFolderById(folderId);
    
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);
    
    const files = folder.getFiles();
    let deletedCount = 0;
    let freedSpace = 0;
    
    while (files.hasNext()) {
      const file = files.next();
      const fileDate = file.getDateCreated();
      
      if (fileDate < cutoffDate) {
        console.log(`Deleting old file: ${file.getName()} (${fileDate})`);
        freedSpace += file.getSize();
        file.setTrashed(true);
        deletedCount++;
      }
    }
    
    console.log(`Cleanup completed. Deleted ${deletedCount} files, freed ${formatFileSize(freedSpace)}`);
    
    return {
      deletedCount: deletedCount,
      freedSpace: freedSpace,
      formattedFreedSpace: formatFileSize(freedSpace)
    };
    
  } catch (error) {
    console.error('Error during cleanup:', error);
    throw error;
  }
}

/**
 * Test function for Drive operations including folder organization
 * フォルダ整理を含むDrive操作のテスト関数
 */
function testDriveOperations() {
  console.log('=== TESTING Drive Operations ===');
  
  try {
    // Test base folder access
    const folderId = getProperty(PROPERTY_KEYS.DRIVE_FOLDER_ID);
    const baseFolder = DriveApp.getFolderById(folderId);
    console.log(`✓ Base Drive folder accessible: ${baseFolder.getName()}`);
    
    // Test email folder creation
    const testSubject = '組織メルマガ／会員企業からのお知らせ＆PR';
    const testDate = new Date();
    const emailFolder = createEmailFolder(baseFolder, testSubject, testDate);
    console.log(`✓ Email folder created: ${emailFolder.getName()}`);
    
    // Test subject cleaning for folder names
    const cleanSubject = cleanSubjectForFolder('【本日開催】第14回部会開催のご案内※6/5（木）15:00開催');
    console.log(`✓ Subject cleaned for folder: ${cleanSubject}`);
    
    // Test simple filename generation
    const simpleFileName = generateSimpleFilename(0, 'test-document.pdf');
    console.log(`✓ Simple filename generated: ${simpleFileName}`);
    
    // Test unique filename generation
    const uniqueName = ensureUniqueFilename(emailFolder, simpleFileName);
    console.log(`✓ Unique filename: ${uniqueName}`);
    
    // Test file size formatting
    const sizes = [0, 1024, 1048576, 1073741824];
    sizes.forEach(size => {
      console.log(`✓ ${size} bytes = ${formatFileSize(size)}`);
    });
    
    // Test folder stats
    const stats = getDriveFolderStats();
    if (stats) {
      console.log(`✓ Folder stats: ${stats.fileCount} files, ${stats.formattedSize}`);
    }
    
    // Test folder structure
    console.log('\n--- Testing Folder Organization ---');
    const testEmailSubjects = [
      '組織メルマガ／会員企業からのお知らせ＆PR',
      '【本日開催】第14回部会開催のご案内※6/5（木）15:00開催',
      '勉強会『最新技術の先行事例』※5月27日'
    ];
    
    testEmailSubjects.forEach((subject, index) => {
      const testFolderDate = new Date(Date.now() + (index * 24 * 60 * 60 * 1000)); // Different dates
      const folder = createEmailFolder(baseFolder, subject, testFolderDate);
      console.log(`✓ Created folder ${index + 1}: ${folder.getName()}`);
    });
    
    console.log('Drive operations test completed successfully');
    
  } catch (error) {
    console.error('Drive operations test failed:', error);
    throw error;
  }
}