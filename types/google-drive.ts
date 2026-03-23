export interface GoogleSpreadsheetFile {
  id: string;
  name: string;
  createdTime?: string;
  modifiedTime?: string;
  webViewLink?: string;
  owners?: Array<{
    displayName?: string;
    emailAddress?: string;
  }>;
}
