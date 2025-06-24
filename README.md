# Gmail to Slack Forwarder

A Google Apps Script-based system that automatically forwards Gmail messages from specific senders to Slack and saves attachments to Google Drive.

## Features

- 🔍 **Smart Monitoring**: Automated monitoring of emails from specific senders with message-level tracking
- 📧 **Advanced Pattern Matching**: Multiple regex patterns for complex email subjects and organizational formats
- 🚨 **Rich Slack Notifications**: Instant notifications with full email content and attachment details
- 📱 **Intelligent PDF Management**: Automatic PDF detection and organized Google Drive storage
- 📁 **Smart Folder Organization**: Date + subject-based folder structure for easy file management
- 📎 **Follow-up Notifications**: Dedicated Drive folder links sent as separate Slack messages
- ⏰ **Automated Scheduling**: Periodic checks every 5 minutes with robust error handling
- 🔄 **Message-Level Duplicate Prevention**: Handles same-subject emails without skipping new messages
- 📊 **Comprehensive Logging**: Detailed processing statistics and Drive folder URLs
- ⚡ **Selective Processing**: Only creates Drive folders when PDF files are detected
- 📋 **Spreadsheet-Based Tracking**: Scalable message tracking using Google Sheets (no Script Properties limitations)

## Quick Start

### 1. Prerequisites
- Google Account (for Gmail, Drive, and Apps Script access)
- Slack Workspace (with Incoming Webhooks permissions)
- Node.js v14+ (for development environment)
- Clasp CLI

### 2. Local Development Setup
```bash
# Clone and setup
git clone <your-repo>
cd gmail-slack-forwarder

# Install dependencies
npm install

# Clasp authentication (first time only)
npm run login

# Create Google Apps Script project
clasp create --type standalone --title "Gmail Slack Forwarder"

# If you encounter "Project file already exists" error:
# rm .clasp.json
# clasp create --type standalone --title "Gmail Slack Forwarder"

# Verify project creation
cat .clasp.json  # Should show scriptId

# Deploy code to Google Apps Script
npm run push
```

### 3. Configuration
⚠️ **SECURITY NOTICE**: All sensitive information is stored in Script Properties, NOT in code!

#### 3.1 Slack Webhook Setup
1. Add Incoming Webhooks app to your Slack workspace
2. Select notification channel and generate Webhook URL
3. **Keep this URL secure** - it will be stored in Script Properties

#### 3.2 Drive Folder Setup (Optional - Set Before Configuration)

The system supports both automatic and manual Drive folder setup:

**🆕 New: Smart PDF Detection**
- 📦 **PDF files only**: Drive folders are created ONLY when PDF attachments are detected
- 📁 **Organized structure**: Each email gets its own subfolder (YYYY-MM-DD_EmailSubject)
- 🔗 **Direct links**: Slack notifications include clickable folder and file links
- ⚠️ **Non-PDF files**: Other attachment types are noted but not saved to Drive

**Option 1: Automatic (Default)**
- System automatically creates a base folder named "Gmail Attachments"
- PDF files are organized in date + subject subfolders
- No additional setup required
- Folder ID is automatically saved to Script Properties

**Option 2: Manual Setup**
If you want to use an existing folder or specify a custom location:

1. **Create or locate your folder in Google Drive**
2. **Get the folder ID from the URL:**
   ```
   https://drive.google.com/drive/folders/1ABC123XYZ789def456
                                    ^^^^^^^^^^^^^^^^^^
                                    This is your folder ID
   ```
3. **Save the folder ID** - you'll set this in the next step along with other properties

**📁 Folder Structure Example:**
```
Gmail Attachments/
├── 2025-06-18_月例ニュースレター/
│   ├── document1.pdf
│   └── presentation.pdf
├── 2025-06-19_第14回部会開催のご案内/
│   └── meeting_materials.pdf
└── 2025-06-20_勉強会開催通知/
    └── study_guide.pdf
```

**Folder Permissions:**
- The folder will be accessible to the Google account running the script
- Shared folders are supported if you have edit permissions
- System automatically creates organized subfolders for each email with PDFs

#### 3.3 Required Script Properties Configuration

You need to set exactly **3 required properties** (plus 1 optional) in Google Apps Script Properties:

| Property Key | Description | Example Value | Required |
|--------------|-------------|---------------|----------|
| `SENDER_EMAIL` | Email address to monitor for incoming messages | `your-sender@example.com` | ✅ Yes |
| `SLACK_WEBHOOK_URL` | Slack Incoming Webhook URL from your workspace | `https://hooks.slack.com/services/TXXXXXXXX/BXXXXXXXX/your-webhook-key` | ✅ Yes |
| `SLACK_CHANNEL` | Slack channel where notifications will be sent | `#email-notifications` | ✅ Yes |
| `DRIVE_FOLDER_ID` | Google Drive folder ID for attachments | `1ABC123XYZ789def456` | ⚪ Auto-created or Manual |

#### 3.4 How to Set Script Properties

Choose one of these methods to configure the required properties:

**Method 1: Using Functions (Easy for Beginners)**
Execute this function in Google Apps Script editor:

```javascript
// Replace with your actual values before executing!
function setRequiredConfiguration() {
  // 1. Monitor emails from this address
  setProperty('SENDER_EMAIL', 'your-sender@example.com');
  
  // 2. Send notifications to this Slack webhook
  setProperty('SLACK_WEBHOOK_URL', 'https://hooks.slack.com/services/TXXXXXXXX/BXXXXXXXX/your-actual-webhook-key');
  
  // 3. Post notifications in this channel
  setProperty('SLACK_CHANNEL', '#your-channel');
  
  // 4. Optional: Set custom Drive folder (if you chose Manual Setup in step 3.2)
  // setProperty('DRIVE_FOLDER_ID', '1ABC123XYZ789def456');
}
```

**Method 2: Manual Setup (Direct Property Setting)**
Go to Google Apps Script → Project Settings → Script Properties and manually add:
- Key: `SENDER_EMAIL`, Value: `your-sender@example.com`
- Key: `SLACK_WEBHOOK_URL`, Value: `https://hooks.slack.com/services/TXXXXXXXX/BXXXXXXXX/your-webhook-key`
- Key: `SLACK_CHANNEL`, Value: `#your-channel`
- Key: `DRIVE_FOLDER_ID`, Value: `1ABC123XYZ789def456` (only if using Manual Drive setup from step 3.2)

**Both methods achieve the same result** - choose whichever you find easier!

**Verification**
```javascript
// Check your configuration (safely displays without exposing secrets)
showConfiguration();
```

Expected output:
```
=== Current Configuration ===
Sender Email: your-sender@example.com
Slack Channel: your-channel
Webhook URL: [SET]
Drive Folder ID: 1ABC123XYZ789def456

Pattern Settings:
Multiple patterns enabled: true
Total patterns: 4
```

**Note**: 
- Sender Email: Shows your configured email address
- Slack Channel: Shows your actual channel name (with or without # prefix)
- Webhook URL: Always shows "[SET]" to protect the secret URL
- Drive Folder ID: Shows the actual folder ID when auto-created
- Pattern Settings: Displays the current subject pattern configuration

#### 3.5 Environment File Reference (Optional - For Local Documentation Only)

The `.env.example` file is provided **only for documentation and local reference**. Google Apps Script doesn't read `.env` files - all configuration must be set in Script Properties.

**When you might use this:**
1. **Local documentation**: Keep track of your configuration values locally
2. **Team sharing**: Share configuration structure (without actual secrets) with team members
3. **Backup reference**: Remember what values you've configured

**Usage (Optional):**
```bash
# Copy the example file for your local reference
cp .env.example .env

# Edit .env with your actual values for documentation
# ⚠️ IMPORTANT: Never commit .env to git! (.gitignore already excludes it)
# ⚠️ The .env file is NOT read by Google Apps Script
# ⚠️ You still must set values in Script Properties using Methods 1 or 2 above
```

**Why we include this:**
- **Standard practice**: Most projects include `.env.example` for configuration documentation
- **Developer convenience**: Easier to track what configuration you've set
- **Future flexibility**: If you later build local development tools that integrate with this system

**Key point**: The `.env` file is purely for your convenience - Google Apps Script only reads from Script Properties!

### 4. Deploy
```bash
# Push code to Google Apps Script (if not done in step 2)
npm run push

# Verify deployment
npm run open
```

**🔧 Latest Updates:**
- **Message-level processing**: Same-subject emails are now handled correctly
- **PDF-only Drive folders**: Folders are created only when PDF attachments are found
- **Enhanced logging**: Detailed folder URLs and file paths in processing logs
- **Follow-up notifications**: Separate Slack messages with Drive folder links

### 5. Initialize
Execute the following functions in Google Apps Script editor in order:

```javascript
// 1. Set up your configuration (REQUIRED FIRST!)
// Only run this if you chose Method 1 in step 3.3:
setRequiredConfiguration();  // From: src/main.js - Skip if you used Manual Setup (Method 2)

// 2. Verify configuration was set correctly
showConfiguration();  // From: src/main.js
// Expected: Shows your actual email and channel, [SET] for webhook

// 3. NEW: Setup spreadsheet tracking system
setupSpreadsheetTracking();  // From: src/main.js
// Expected: Creates tracking spreadsheet, migrates existing data if any

// 4. Test that all properties are accessible
testConfiguration();  // From: src/testRunner.js
// Expected: All validation checks pass

// 5. Test the complete system
runAllTests();  // From: src/testRunner.js
// Expected: 100% success rate on all tests

// 6. Enable automatic email monitoring
setupInitialTrigger();  // From: src/triggerManager.js
// Expected: Trigger created, Slack notification of activation
```

**🔍 Troubleshooting Configuration:**
If any step fails, check:
1. All 3 Script Properties are set: `SENDER_EMAIL`, `SLACK_WEBHOOK_URL`, `SLACK_CHANNEL`
2. Webhook URL is valid and starts with `https://hooks.slack.com/`
3. Channel name is correct (can be with or without `#` prefix, e.g., `your-channel` or `#your-channel`)
4. Email address is the exact sender you want to monitor

**🆕 Testing PDF Processing:**
To test PDF attachment processing:
```javascript
// Test with actual emails (recommended)
testProcessEmails();  // From: src/testRunner.js
// or
processEmails();      // From: src/main.js

// Check Drive operations
testDriveOperations(); // From: src/driveManager.js
```

## Advanced Configuration

### 🆕 New Features Configuration

#### Email Content Display
```javascript
// In src/main.js CONFIG object:
SHOW_FULL_EMAIL_BODY: true,              // Show full email content (up to 7500 chars)
BODY_PREVIEW_LENGTH: 7500,               // Maximum email content length
SEND_DRIVE_FOLDER_NOTIFICATION: true,    // Send follow-up Drive folder links
```

#### Message-Level Duplicate Prevention
The system now tracks individual messages instead of email threads:
- ✅ **Same subject, new emails**: Processed correctly
- ✅ **Email thread replies**: Each message handled separately  
- ✅ **Reliable tracking**: Uses message IDs stored in Google Sheets
- ✅ **Scalable storage**: No Script Properties limitations

#### 🆕 Spreadsheet-Based Tracking
The system uses Google Sheets for tracking processed messages:
- **Automatic creation**: Spreadsheet created on first run
- **Migration support**: Existing Script Properties data migrated automatically
- **Self-maintaining**: Keeps last 10,000 messages, auto-deletes older entries
- **Visible tracking**: View processed messages directly in Google Sheets

#### Maintenance Functions
```javascript
// View tracking spreadsheet statistics
getTrackingStats(); // From: src/spreadsheetManager.js

// Migrate existing data from Script Properties (if needed)
migrateProcessedMessagesToSheet(); // From: src/spreadsheetManager.js

// Clean up Script Properties after migration (optional)
cleanupProcessedMessagesFromProperties(); // From: src/spreadsheetManager.js
```

### Subject Pattern Customization
The system supports multiple regex patterns for complex Japanese email subjects:

```javascript
SUBJECT_PATTERNS: {
  ENABLE_MULTIPLE_PATTERNS: true,
  MATCH_MODE: 'any',  // 'any' or 'all'
  PATTERNS: [
    // Organization newsletter
    /\w+メルマガ[／\/].*お知らせ.*PR/,
    
    // Event notifications with brackets
    /【.*】第\d+回.*部会/,
    
    // Study sessions
    /勉強会.*『.*』.*※.*開/,
    
    // Re-send notifications
    /【再送】.*開催.*案内/,
    
    // Add your own patterns here
  ]
}

// 🆕 Enhanced processing: Only creates Drive folders for PDF attachments

// Legacy single pattern (still supported)
SUBJECT_PATTERN: /第\d+回.*部会|メルマガ|勉強会/
```

**Example subjects that will match:**
- `組織メルマガ／会員企業からのお知らせ＆PR`
- `【本日開催】第14回部会開催のご案内※6/5（木）15:00開催`
- `【再送】第14回部会開催のご案内※6/5（木）15:00開催`
- `勉強会『最新技術の動向』※5月27日(火)17:00開催`

### Changing Slack Notification Settings

#### Changing Notification Channel
To change which Slack channel receives notifications:

**Method 1: Using Google Apps Script Function**
```javascript
// Execute this function in Google Apps Script editor
function updateSlackChannel() {
  // Replace with your new channel name (with or without # prefix)
  setProperty('SLACK_CHANNEL', '#new-channel-name');
  console.log('Slack channel updated successfully');
}
```

**Method 2: Manual Script Properties Update**
1. Open Google Apps Script editor (`npm run open`)
2. Go to **Project Settings** → **Script Properties**
3. Find the `SLACK_CHANNEL` property
4. Update the value to your new channel (e.g., `#alerts`, `notifications`)
5. Save changes

**Method 3: Update and Re-run Configuration**
```javascript
// Update all settings including channel
function updateConfiguration() {
  setProperty('SENDER_EMAIL', 'your-sender@example.com');
  setProperty('SLACK_WEBHOOK_URL', 'your-webhook-url');
  setProperty('SLACK_CHANNEL', '#your-new-channel');  // ← Update this
  
  console.log('Configuration updated successfully');
}
```

**Verification:**
After updating the channel, verify the change:
```javascript
// Check current configuration
showConfiguration();  // From: src/main.js

// Send test notification to new channel
sendTestNotification();  // From: src/slackNotifier.js
```

#### Changing Webhook URL (Different Workspace/App)
If you need to change the entire webhook (different workspace or app):

1. **Create new Slack webhook:**
   - Go to your Slack workspace settings
   - Add "Incoming Webhooks" app (or use existing)
   - Select the desired channel
   - Copy the new webhook URL

2. **Update webhook in Script Properties:**
```javascript
function updateSlackWebhook() {
  const newWebhookUrl = 'https://hooks.slack.com/services/TXXXXXXXX/BXXXXXXXX/your-new-webhook-key';
  setProperty('SLACK_WEBHOOK_URL', newWebhookUrl);
  console.log('Slack webhook updated successfully');
}
```

3. **Test the new webhook:**
```javascript
// Verify webhook works with new channel
testSlackNotifications();  // From: src/testRunner.js
```

**Important Notes:**
- Channel names can be with or without `#` prefix (e.g., `alerts` or `#alerts`)
- Make sure the webhook has permission to post to the target channel
- Test changes with `sendTestNotification()` before processing real emails
- Changes take effect immediately - no code redeployment needed

### 🆕 Enhanced Slack Notifications

#### Dual Notification System
1. **Main Email Notification**: Complete email content with attachment summary
2. **Follow-up Drive Notification**: Dedicated message with clickable folder links (when PDFs are saved)

#### Notification Content Features
- 📝 **Full email content**: Up to 7,500 characters (configurable)
- 📎 **Smart attachment handling**: 
  - ✅ **PDF files**: Saved to organized Drive folders
  - ⚠️ **Other files**: Listed but marked as "skipped"
- 🔗 **Direct links**: Clickable file and folder URLs
- 📁 **Folder organization**: Date + subject naming

#### Attachment Display Format
```
📎 添付ファイル (2/3件 (1件スキップ))
• ✅ document.pdf (1.2MB) in 2025-06-18_組織メルマガ - 📄 File | 📁 Folder
• ⚠️ image.jpg (500KB) - スキップ: Not a PDF file
• ✅ report.pdf (800KB) in 2025-06-18_組織メルマガ - 📄 File | 📁 Folder
```

### Notification Customization
Slack message format can be adjusted in `src/slackNotifier.js`:
- Modify email content length (`formatEmailBody` function)
- Change attachment display format (`buildAttachmentText` function)
- Customize follow-up notification content (`sendDriveFolderNotification` function)
- Adjust color rules and message structure

## Email Processing Logic & Architecture

### 🆕 Enhanced Monitoring Strategy
The system now uses **message-level processing** to handle same-subject emails correctly:

#### 1. **Smart Gmail Search**
- **Method**: `from:{SENDER_EMAIL}` (checks ALL threads, not just unprocessed)
- **Enhancement**: Individual message tracking prevents skipping new emails in existing threads
- **Data Retrieved**: All email threads from specified sender

#### 2. **Message-Level Duplicate Prevention**
- **Purpose**: Track each individual message, not just threads
- **Method**: Store processed message IDs in Script Properties
- **Advantage**: Same-subject emails in existing threads are processed correctly

#### 3. **Advanced Subject Pattern Matching**
- **Purpose**: Precise identification of target emails using multiple regex patterns
- **Support**: Complex Japanese email formats and organizational patterns
- **Flexibility**: Easy addition of new patterns

#### 4. **Intelligent PDF Processing**
- **Detection**: Automatically identifies PDF attachments
- **Selective Processing**: Creates Drive folders ONLY for emails with PDFs
- **Organization**: Date + subject-based folder structure

### 🆕 Enhanced Processing Logic
New message-level processing flow:

```
Improved Email Processing:
├── Search ALL threads from sender
├── For each thread:
│   ├── Check each message individually
│   ├── Message ID already processed? ──┐
│   │   (Check in Google Sheets)        ├── Yes → Skip this message
│   │                                    └── No → Continue processing
│   ├── Subject pattern match? ──┐
│   │                             ├── Yes → Process message
│   │                             └── No → Skip message
│   ├── PDF attachments found? ──┐
│   │                              ├── Yes → Create Drive folder & save
│   │                              └── No → Mark as "skipped"
│   ├── Send main Slack notification
│   ├── Send follow-up Drive folder notification (if PDFs saved)
│   └── Mark message ID as processed in spreadsheet
└── Apply thread label (if any messages were processed)
```

### Performance Optimizations
- **Batch Processing**: Process up to 10 emails at once
- **Error Isolation**: One email failure doesn't affect the entire system
- **Execution Time Monitoring**: Reliable completion within 6-minute limit
- **Duplicate Avoidance**: Ensure unique filenames in Drive

## Slack Notification System

### Notification Types & Triggers

#### 📧 **Email Notifications**
- **Condition**: When pattern-matched email is received
- **Content**: Sender, subject, body excerpt, attachment information
- **Color Coding**: Success=green, Attachment errors=yellow

#### 🚨 **Error Notifications**  
- **Condition**: When system errors occur
- **Content**: Error details, occurrence time
- **Color Coding**: Red (danger)

#### 📊 **Processing Summary**
- **Condition**: When processing completes with errors
- **Content**: Success/failure counts, execution time, success rate

#### ⚡ **Trigger Status Notifications**
- **Condition**: When triggers are created/deleted
- **Content**: Monitoring status, check interval

## Development & Maintenance

### Development Commands
```bash
# Development cycle
npm run push          # Deploy local changes to GAS
npm run pull          # Sync GAS changes to local
npm run logs          # View execution logs (for debugging)
npm run open          # Open GAS editor

# Authentication
npm run login         # Clasp CLI authentication
```

### File Structure
```
gmail-slack-forwarder/
├── package.json           # npm configuration and Clasp commands
├── appsscript.json       # GAS configuration (timezone, APIs)
└── src/
    ├── main.js           # Main configuration and entry point
    ├── emailProcessor.js # Email processing logic
    ├── driveManager.js   # Drive attachment management
    ├── slackNotifier.js  # Slack notification functionality
    ├── spreadsheetManager.js # Spreadsheet-based message tracking
    ├── triggerManager.js # Trigger management
    └── testRunner.js     # Test suite
```

### 🆕 Enhanced Key Functions

#### `main.js`
- `processEmails()`: Main processing entry point with message-level tracking
- `validateConfiguration()`: Configuration validation
- `getOrCreateDriveFolder()`: Drive folder management
- 🆕 `setupSpreadsheetTracking()`: Initialize spreadsheet-based tracking system
- `showConfiguration()`: Display current configuration including tracking stats

#### `emailProcessor.js`
- `processMessage()`: Individual email processing with duplicate prevention
- 🆕 `isMessageAlreadyProcessed()`: Message-level duplicate checking using spreadsheet
- 🆕 `formatEmailBody()`: Smart email content formatting (up to 7500 chars)

#### `driveManager.js`
- 🆕 `processAttachments()`: PDF-only attachment processing
- `saveAttachmentToDrive()`: Execute Drive saving with organized folder structure
- 🆕 `createEmailFolder()`: Date + subject folder creation
- 🆕 `cleanSubjectForFolder()`: Safe folder name generation

#### `slackNotifier.js`
- `sendSlackNotification()`: Enhanced email notifications with full content
- 🆕 `sendDriveFolderNotification()`: Follow-up Drive folder notifications
- `sendErrorNotification()`: Error notifications
- 🆕 `buildAttachmentText()`: Smart attachment display (saved/skipped/failed)

#### `triggerManager.js`
- `createTrigger()`: Create periodic execution trigger
- `checkTriggerHealth()`: Trigger health check

#### 🆕 `spreadsheetManager.js`
- `getOrCreateTrackingSpreadsheet()`: Create/access tracking spreadsheet
- `isMessageProcessedInSheet()`: Check if message already processed
- `markMessageProcessedInSheet()`: Record processed message
- `migrateProcessedMessagesToSheet()`: Migrate from Script Properties
- `getTrackingStats()`: Get spreadsheet statistics
- `cleanupOldEntriesInSheet()`: Auto-cleanup old entries

#### `testRunner.js`
- `runAllTests()`: Comprehensive test suite
- `testProcessEmails()`: Test actual email processing with PDFs
- `testDriveOperations()`: Test Drive folder operations
- `testSlackNotifications()`: Test both main and follow-up notifications
- 🆕 `testSpreadsheetOperations()`: Test spreadsheet tracking

## Troubleshooting

### Common Issues & Solutions

#### 🔧 **Project Setup Issues**
**Symptom**: `clasp push` fails with "Project settings not found"
```bash
# Solution: Create or recreate the GAS project
rm .clasp.json  # Remove existing file
clasp create --type standalone --title "Gmail Slack Forwarder"
cat .clasp.json  # Verify scriptId is set
npm run push
```

#### 🔧 **Emails Not Being Processed**
**Symptom**: New emails exist but no Slack notifications
```javascript
// Debug steps
1. Run testEmailSearch() → Check Gmail search query
2. Run testMessageProcessing() → Check subject pattern
3. Run quickHealthCheck() → Check overall configuration
```

#### 🔧 **Slack Notifications Not Received**
**Symptom**: System operates but no Slack notifications
```javascript
// Resolution steps
1. Run testSlackNotifications()
2. Check Webhook URL: PropertiesService.getScriptProperties().getProperty('SLACK_WEBHOOK_URL')
3. Check channel permissions
```

#### 🔧 **Attachments Not Saved**
**Symptom**: Email notifications received but no files in Drive
```javascript
// Check items
1. Run testDriveOperations()
2. Check Drive API enablement
3. Check folder permissions
```

#### 🔧 **Same-Subject Emails Not Processing**
**Symptom**: New emails with same subject are skipped
🆕 **SOLVED**: This issue has been fixed with spreadsheet-based message-level tracking!
```javascript
// Verification: Check that message-level processing is working
1. Run testProcessEmails() with same-subject emails
2. Check logs for "Message already processed" vs "Processing new message"
3. Open tracking spreadsheet to see processed messages
4. Run getTrackingStats() to view statistics
```

#### 🔧 **No Drive Folders Created**
**Symptom**: Emails processed but no Drive folders
🆕 **Expected Behavior**: Folders only created for PDF attachments
```javascript
// Check if this is expected:
1. Verify emails actually contain PDF attachments
2. Check logs for "Found X PDF files" vs "No PDF files found"
3. Non-PDF attachments will show "skipped: Not a PDF file" in Slack
```

#### 🔧 **Duplicate Processing**
**Symptom**: Same email processed multiple times
```javascript
// Resolution
1. Run checkTriggerHealth() → Remove duplicate triggers
2. Run cleanupOldProcessedMessages() → Clean message tracking
3. Recreate trigger: setupInitialTrigger()
```

### 🆕 Enhanced Debugging Steps
1. **Log Check**: Use `npm run logs` to check latest execution logs
   - Look for "Checked: X messages, Processed: Y" statistics
   - Check for PDF detection: "Found X PDF files" or "No PDF files found"
   - Verify message tracking: "Message already processed (found in spreadsheet)" vs "Processing new message"

2. **Individual Tests**: Run test functions for each module
   - `testProcessEmails()`: Test with actual emails (recommended for PDF testing)
   - `testDriveOperations()`: Test folder creation and organization
   - `testSlackNotifications()`: Test both main and follow-up notifications
   - 🆕 `testSpreadsheetOperations()`: Test spreadsheet tracking

3. **Configuration Validation**: Use `testConfiguration()` to check basic settings

4. **Message Tracking Check**:
   ```javascript
   // Check tracking spreadsheet statistics
   getTrackingStats(); // From: src/spreadsheetManager.js
   
   // View spreadsheet directly
   showConfiguration(); // Shows spreadsheet URL
   ```

5. **Drive Folder Verification**:
   ```javascript
   // Check Drive folder structure
   getDriveFolderStats(); // From: src/driveManager.js
   ```

### Performance Monitoring
**Expected Values**:
- Processing time: 5-15 seconds per email
- Success rate: 95%+
- Trigger execution: Stable operation at 5-minute intervals

**🆕 Enhanced Monitoring Points**:
```javascript
// Check execution statistics
getDriveFolderStats()                    // File saving status
getTriggerInfo()                         // Trigger operation status
getTrackingStats()                       // Spreadsheet tracking statistics

// View tracking spreadsheet
showConfiguration()                      // Shows spreadsheet URL and stats

// Maintenance operations
migrateProcessedMessagesToSheet()        // Migrate from Script Properties if needed
cleanupProcessedMessagesFromProperties() // Clean Script Properties after migration
```

**Expected Log Output**:
```
Checked: 25 messages, Processed: 3, Errors: 0, Time: 4250ms
Found 2 PDF files, processing attachments...
Created/found email folder: 2025-06-18_組織メルマガ
Successfully saved: document.pdf
File URL: https://drive.google.com/file/d/...
Sending follow-up message for 2 saved PDFs...
```

## API Integration Details

### Gmail API Usage Scope
- **Search**: `GmailApp.search()` - Email search
- **Messages**: `message.getSubject()`, `getAttachments()` - Content retrieval
- **Labels**: `GmailApp.createLabel()` - Processed management

### Drive API Usage Scope  
- **Folders**: `DriveApp.createFolder()`, `getFolderById()` - Folder management
- **Files**: `folder.createFile()` - Attachment saving
- **Metadata**: `file.getUrl()`, `getId()` - Link generation

### Slack Webhook Specifications
- **Endpoint**: `https://hooks.slack.com/services/...`
- **Method**: POST
- **Format**: JSON
- **Limits**: 1 request per second recommended

## Security Considerations

### 🔒 Critical Security Features

#### Configuration Security
- **Script Properties Only**: All sensitive data stored in Google Apps Script Properties, never in code
- **Zero Hardcoding**: No webhook URLs, emails, or secrets in source code
- **Public Repository Safe**: Code can be safely published to public GitHub repositories
- **Environment Separation**: Use `.env.example` for documentation, never commit actual `.env` files

#### Access Control
- **Minimum Permissions**: Only essential Google API scopes enabled
- **Drive Isolation**: Access restricted to designated attachment folder only
- **Channel Restrictions**: Slack notifications only to configured channels
- **Email Filtering**: Only processes emails from specified senders

#### Data Protection
- **Log Sanitization**: Sensitive information automatically redacted from logs
- **Secure Property Access**: Configuration helper functions prevent accidental exposure
- **Error Handling**: Error messages don't leak sensitive configuration details
- **Webhook Protection**: URLs never logged or displayed in plain text

#### Repository Security Guidelines
- **`.gitignore`**: Comprehensive exclusion of sensitive files
- **Example Files**: Use `.example` suffix for template configurations
- **Documentation**: Clear instructions for secure setup without exposing secrets
- **Code Reviews**: Security-first approach in all development

### File Access Control
- **Drive Permissions**: Access only specified folders
- **File Sharing**: Default private settings
- **Naming Rules**: Generate unpredictable filenames

### Execution Environment Security
- **OAuth Authentication**: Use Google standard authentication
- **Execution Logs**: Automatic deletion after 30 days
- **Configuration Validation**: Secure validation without exposing values

## License & Support

**License**: MIT License

**Support**: 
- Setup assistance: Follow detailed instructions in README.md
- Bug reports: Report in GitHub repository Issues
- Feature requests: Contributions welcome via Pull Requests

**Contribution Guidelines**:
1. Development following Clasp CLI workflow
2. Implementation of test functions for each feature
3. Comprehensive logging and error handling
4. Configuration value management via Script Properties