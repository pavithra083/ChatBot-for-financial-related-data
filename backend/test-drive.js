import dotenv from 'dotenv';
import { initializeDrive, verifyFolderAccess, uploadFileToDrive } from './config/googleDrive.js';
import fs from 'fs';

dotenv.config();

const testDrive = async () => {
  console.log('🧪 Testing Google Drive Integration...\n');
  
  try {
    
    console.log('1️⃣ Initializing Google Drive...');
    initializeDrive();
    
    
    console.log('\n2️⃣ Verifying folder access...');
    const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
    console.log(`   Folder ID: ${folderId}`);
    
    await verifyFolderAccess(folderId);
    
  
    console.log('\n3️⃣ Creating test file...');
    const testContent = 'This is a test file from Financial Chatbot';
    const testFilePath = './test-upload.txt';
    fs.writeFileSync(testFilePath, testContent);
    console.log('   ✅ Test file created');
    
    
    console.log('\n4️⃣ Uploading test file...');
    const result = await uploadFileToDrive(
      testFilePath,
      'test-file-' + Date.now() + '.txt',
      folderId
    );
    
    console.log('\n✅ TEST PASSED!');
    console.log(`🔗 View file: ${result.webViewLink}`);
    
    
    fs.unlinkSync(testFilePath);
    console.log('\n🧹 Test file cleaned up');
    
  } catch (error) {
    console.error('\n❌ TEST FAILED!');
    console.error('Error:', error.message);
    console.error('\nPossible solutions:');
    console.error('1. Make sure google-credentials.json exists in backend/');
    console.error('2. Verify GOOGLE_DRIVE_FOLDER_ID is correct in .env');
    console.error('3. Share the folder with your service account email');
    console.error('4. Give service account "Editor" permission on the folder');
  }
};

testDrive();