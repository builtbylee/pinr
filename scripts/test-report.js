/**
 * Test script to simulate a content report using environment credentials
 */

const admin = require('firebase-admin');

// Initialize using default credentials (works with gcloud auth)
admin.initializeApp({
  credential: admin.credential.applicationDefault(),
  projectId: 'days-c4ad4'
});

const db = admin.firestore();

async function testReport() {
  console.log('🔍 Creating a test report...');
  
  // Create a test report - this will trigger onReportCreated
  const report = {
    reporterId: 'FVgteJzI1VTVSSQIfNXk5I85Zpj1',
    reportedUserId: 'test-moderation-check',
    reason: 'other',
    description: 'TEST REPORT - Verifying moderation system works. Please ignore this report.',
    status: 'pending',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  };
  
  const reportRef = await db.collection('reports').add(report);
  console.log('✅ Test report created:', reportRef.id);
  console.log('');
  console.log('📧 Check lee@getpinr.com for admin notification email!');
  console.log('   (Email should arrive within 1-2 minutes)');
}

testReport()
  .then(() => {
    console.log('\n✅ Test complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error:', error.message);
    console.log('\nIf you see a credential error, run:');
    console.log('  gcloud auth application-default login');
    process.exit(1);
  });
