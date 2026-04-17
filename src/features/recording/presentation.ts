export function getRecordingNoticeBody() {
  return 'Recording keeps running while the app is in the background. If you force-quit the app, the session can be lost.';
}

export function getRecordingStatusLabel(isRecording: boolean) {
  return isRecording ? 'Recording in progress' : 'Ready to record';
}

export function getRecordingSupportLabel() {
  return 'Phone mic, background recording enabled';
}
