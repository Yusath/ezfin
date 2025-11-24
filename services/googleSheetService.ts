import { Transaction, TransactionItem, Category } from "../types";

declare global {
  interface Window {
    gapi: any;
    google: any;
  }
}

// User provided Client ID
const DEFAULT_CLIENT_ID = "28569786950-2lnehaar8vn0cueo4gpav84umuc30kc1.apps.googleusercontent.com";

// Initial load from Env or LocalStorage or Default
let CLIENT_ID = process.env.GOOGLE_CLIENT_ID || localStorage.getItem('GOOGLE_CLIENT_ID') || DEFAULT_CLIENT_ID;
let API_KEY = process.env.GOOGLE_API_KEY || localStorage.getItem('GOOGLE_API_KEY') || "";

const DISCOVERY_DOCS = ["https://sheets.googleapis.com/$discovery/rest?version=v4", "https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"];
const SCOPES = "https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file openid email profile";

let tokenClient: any;
let accessToken: string | null = null;
let isInitialized = false;

const loadScript = (src: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
       resolve(); 
       return;
    }
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = (e) => reject(e);
    document.body.appendChild(script);
  });
};

export const googleSheetService = {
  
  get isConfigured() {
    return !!CLIENT_ID;
  },

  updateCredentials: (clientId: string, apiKey?: string) => {
    CLIENT_ID = clientId;
    localStorage.setItem('GOOGLE_CLIENT_ID', clientId);
    if (apiKey) {
      API_KEY = apiKey;
      localStorage.setItem('GOOGLE_API_KEY', apiKey);
    }
    // Reset internal state to allow re-initialization
    isInitialized = false;
    tokenClient = undefined;
  },

  initClient: async (onInitComplete: (success: boolean) => void) => {
    if (isInitialized) {
        onInitComplete(true);
        return;
    }

    if (!CLIENT_ID) {
      onInitComplete(false);
      return;
    }

    try {
      await Promise.all([
        loadScript("https://apis.google.com/js/api.js"),
        loadScript("https://accounts.google.com/gsi/client")
      ]);

      await new Promise<void>((resolve) => {
        if (window.gapi) {
          window.gapi.load('client', resolve);
        } else {
          const interval = setInterval(() => {
             if (window.gapi) {
               clearInterval(interval);
               window.gapi.load('client', resolve);
             }
          }, 100);
        }
      });

      // Initialize GAPI Client
      try {
        await window.gapi.client.init({
            apiKey: API_KEY,
            discoveryDocs: DISCOVERY_DOCS,
        });
      } catch (gapiError) {
        console.warn("GAPI init warning:", gapiError);
      }

      if (!window.google) {
         await new Promise<void>(resolve => {
            const interval = setInterval(() => {
                if (window.google) {
                    clearInterval(interval);
                    resolve();
                }
            }, 100);
         });
      }

      tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        callback: (resp: any) => {
          if (resp.error !== undefined) {
            throw (resp);
          }
          accessToken = resp.access_token;
          // CRITICAL FIX: Manually set the token for GAPI
          if (window.gapi && window.gapi.client) {
            window.gapi.client.setToken(resp);
          }
        },
      });

      isInitialized = true;
      onInitComplete(true);

    } catch (error) {
      console.error("Failed to initialize Google Services:", error);
      onInitComplete(false);
    }
  },

  signIn: (): Promise<string> => {
    return new Promise((resolve, reject) => {
      if (!CLIENT_ID) return reject("Configuration Error: Missing Client ID");
      
      const promptSignIn = () => {
         if (!tokenClient) return reject("Google Token Client not ready");
         
         // Override callback to capture response for this specific request
         tokenClient.callback = (resp: any) => {
            if (resp.error) {
                reject(resp);
            } else {
                accessToken = resp.access_token;
                // CRITICAL FIX: Bind the token to GAPI client immediately
                if (window.gapi && window.gapi.client) {
                   window.gapi.client.setToken(resp);
                }
                resolve(resp.access_token);
            }
         };
         
         // Trigger the popup
         tokenClient.requestAccessToken({prompt: 'consent'});
      };

      if (!tokenClient) {
          googleSheetService.initClient((success) => {
              if(!success) return reject("Google API not initialized. Check Client ID.");
              promptSignIn();
          });
      } else {
          promptSignIn();
      }
    });
  },

  signOut: () => {
    const token = window.gapi?.client?.getToken();
    if (token !== null) {
      window.google?.accounts?.oauth2?.revoke(token.access_token, () => {});
      window.gapi?.client?.setToken(null); // Clear GAPI token
      accessToken = null;
    }
  },

  getUserInfo: async (token: string): Promise<{ name: string, email: string, picture: string }> => {
    try {
      const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      return {
        name: data.name,
        email: data.email,
        picture: data.picture
      };
    } catch (error) {
      console.error("Failed to fetch user info", error);
      throw error;
    }
  },

  searchFolders: async (query: string): Promise<Array<{id: string, name: string}>> => {
     try {
       // Search for folders only
       const q = `mimeType = 'application/vnd.google-apps.folder' and name contains '${query}' and trashed = false`;
       const response = await window.gapi.client.drive.files.list({
         q: q,
         fields: 'files(id, name)',
         spaces: 'drive',
         pageSize: 10
       });
       return response.result.files;
     } catch (error) {
       console.error("Folder search failed", error);
       return [];
     }
  },

  createSpreadsheet: async (title: string, folderId?: string): Promise<{ id: string, name: string }> => {
    try {
      if (!accessToken && window.gapi?.client?.getToken() === null) {
        throw new Error("No access token available. Please sign in.");
      }

      // 1. Create Sheet (Initially in Root)
      const response = await window.gapi.client.sheets.spreadsheets.create({
        resource: {
          properties: {
            title: title,
          },
        },
      });

      const spreadsheetId = response.result.spreadsheetId;
      
      // 2. Move to specific folder if requested
      if (folderId) {
        // Retrieve existing parents to remove them
        const file = await window.gapi.client.drive.files.get({
          fileId: spreadsheetId,
          fields: 'parents'
        });
        
        const previousParents = file.result.parents.join(',');
        
        // Move file
        await window.gapi.client.drive.files.update({
          fileId: spreadsheetId,
          addParents: folderId,
          removeParents: previousParents,
          fields: 'id, parents'
        });
      }
      
      // 3. Initialize Header
      const values = [
        ["ID", "Date (ISO)", "Store", "Category", "Type", "Total Amount", "Items Detail"]
      ];
      
      await window.gapi.client.sheets.spreadsheets.values.update({
        spreadsheetId: spreadsheetId,
        range: 'Sheet1!A1',
        valueInputOption: 'RAW',
        resource: {
          values: values,
        },
      });
      
      // 4. Styling
      await window.gapi.client.sheets.spreadsheets.batchUpdate({
        spreadsheetId: spreadsheetId,
        resource: {
          requests: [
            {
              repeatCell: {
                range: { sheetId: 0, startRowIndex: 0, endRowIndex: 1 },
                cell: {
                  userEnteredFormat: {
                    backgroundColor: { red: 0.0, green: 0.48, blue: 1.0 },
                    textFormat: { foregroundColor: { red: 1.0, green: 1.0, blue: 1.0 }, bold: true }
                  }
                },
                fields: "userEnteredFormat(backgroundColor,textFormat)"
              }
            }
          ]
        }
      });

      return { id: spreadsheetId, name: title };
    } catch (error) {
      console.error("Error creating sheet", error);
      throw error;
    }
  },

  appendTransaction: async (spreadsheetId: string, tx: Transaction) => {
    if (!accessToken && window.gapi?.client?.getToken() === null) {
        console.warn("Skipping sync: No access token");
        return;
    }

    // Format items string: "2x Burger (@20000), 1x Coke (@5000)"
    const itemDetails = tx.items.map(i => `${i.qty}x ${i.name} (@${i.price})`).join(", ");
    
    // We store ISO date for machine readability in the future restoration
    const row = [
      tx.id,
      tx.date, 
      tx.storeName,
      tx.category,
      tx.type,
      tx.totalAmount,
      itemDetails
    ];

    try {
      await window.gapi.client.sheets.spreadsheets.values.append({
        spreadsheetId: spreadsheetId,
        range: 'Sheet1!A1',
        valueInputOption: 'USER_ENTERED',
        resource: {
          values: [row],
        },
      });
    } catch (error) {
      console.error("Error appending row", error);
      throw error;
    }
  },

  bulkAppendTransactions: async (spreadsheetId: string, transactions: Transaction[]) => {
    if (!accessToken && window.gapi?.client?.getToken() === null) return;
    
    const rows = transactions.map(tx => {
      const itemDetails = tx.items.map(i => `${i.qty}x ${i.name} (@${i.price})`).join(", ");
      return [
        tx.id,
        tx.date, 
        tx.storeName,
        tx.category,
        tx.type,
        tx.totalAmount,
        itemDetails
      ];
    });

    try {
      await window.gapi.client.sheets.spreadsheets.values.append({
        spreadsheetId: spreadsheetId,
        range: 'Sheet1!A1',
        valueInputOption: 'USER_ENTERED',
        resource: {
          values: rows,
        },
      });
    } catch (error) {
      console.error("Error bulk appending", error);
      throw error;
    }
  },

  searchSpreadsheets: async (query: string): Promise<Array<{id: string, name: string}>> => {
    try {
        const response = await window.gapi.client.drive.files.list({
            q: `mimeType='application/vnd.google-apps.spreadsheet' and name contains '${query}' and trashed=false`,
            fields: 'files(id, name)',
            spaces: 'drive'
        });
        return response.result.files;
    } catch (error) {
        console.error("Search failed", error);
        return [];
    }
  },

  fetchTransactions: async (spreadsheetId: string): Promise<Transaction[]> => {
    // Check token existence
    if (!accessToken && window.gapi?.client?.getToken() === null) {
        throw new Error("Not logged in");
    }
    
    try {
      const response = await window.gapi.client.sheets.spreadsheets.values.get({
        spreadsheetId: spreadsheetId,
        range: 'Sheet1!A2:G', // Assuming A2 start (skip header)
      });
      
      const rows = response.result.values;
      if (!rows || rows.length === 0) return [];

      return rows.map((row: any[]) => {
        // Parse Items from string: "2x Burger (@20000), ..."
        const itemsString = row[6] || "";
        const items: TransactionItem[] = [];
        
        // Simple regex to try and reconstruct items
        // Format: qty "x" name "(@" price ")"
        const regex = /(\d+)x\s(.+?)\s\(@(\d+)\)/g;
        let match;
        while ((match = regex.exec(itemsString)) !== null) {
            items.push({
                id: Math.random().toString(36).substr(2, 9),
                qty: parseInt(match[1]),
                name: match[2],
                price: parseInt(match[3])
            });
        }

        // Fallback if parsing failed but text exists
        if (items.length === 0 && itemsString) {
            items.push({
                id: Math.random().toString(36).substr(2, 9),
                name: itemsString,
                qty: 1,
                price: Number(row[5]) || 0
            });
        }

        return {
            id: row[0],
            date: row[1], // ISO string from sheet
            storeName: row[2],
            category: row[3],
            type: row[4] as 'expense' | 'income',
            totalAmount: Number(row[5]),
            items: items
        };
      });

    } catch (error) {
      console.error("Fetch transactions failed", error);
      throw error;
    }
  },

  // --- SETTINGS SYNC (PIN & Categories & Theme) ---

  ensureSettingsSheet: async (spreadsheetId: string) => {
    try {
      const meta = await window.gapi.client.sheets.spreadsheets.get({
          spreadsheetId,
          fields: 'sheets.properties.title'
      });
      const exists = meta.result.sheets.some((s: any) => s.properties.title === 'Settings');
      if (!exists) {
          await window.gapi.client.sheets.spreadsheets.batchUpdate({
              spreadsheetId,
              resource: {
                  requests: [{ addSheet: { properties: { title: 'Settings', hidden: true } } }]
              }
          });
          // Initialize headers
           await window.gapi.client.sheets.spreadsheets.values.update({
              spreadsheetId,
              range: 'Settings!A1:C1',
              valueInputOption: 'RAW',
              resource: { values: [['PIN', 'CATEGORIES', 'DARK_MODE']] }
          });
      }
    } catch (e) {
      console.error("Failed to ensure settings sheet", e);
    }
  },

  saveAppSettings: async (spreadsheetId: string, pin: string, categories: Category[], darkMode: boolean) => {
      try {
        await googleSheetService.ensureSettingsSheet(spreadsheetId);
        await window.gapi.client.sheets.spreadsheets.values.update({
            spreadsheetId,
            range: 'Settings!A2:C2',
            valueInputOption: 'RAW',
            resource: { values: [[pin, JSON.stringify(categories), darkMode.toString()]] }
        });
      } catch (e) {
        console.error("Failed to save app settings", e);
      }
  },

  fetchAppSettings: async (spreadsheetId: string): Promise<{ pin?: string, categories?: Category[], darkMode?: boolean } | null> => {
      try {
          const response = await window.gapi.client.sheets.spreadsheets.values.get({
              spreadsheetId,
              range: 'Settings!A2:C2'
          });
          const rows = response.result.values;
          if (!rows || rows.length === 0) return null;
          
          let cats = [];
          try {
             cats = JSON.parse(rows[0][1] || '[]');
          } catch(e) {}

          let darkMode = false;
          if (rows[0][2]) {
             darkMode = rows[0][2] === 'true';
          }

          return {
              pin: rows[0][0],
              categories: cats,
              darkMode: darkMode
          };
      } catch (e) {
          console.warn("Settings sheet missing or empty", e);
          return null;
      }
  }
};