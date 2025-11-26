
import { Transaction, TransactionItem, Category } from "../types";

declare global {
  interface Window {
    gapi: any;
    google: any;
  }
}

// User provided Client ID
const DEFAULT_CLIENT_ID = "28569786950-2lnehaar8vn0cueo4gpav84umuc30kc1.apps.googleusercontent.com";
// PERSISTENCE: Key for local storage
const TOKEN_STORAGE_KEY = 'ezfin_google_access_token';

// Initial load from Env or LocalStorage
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

  get hasValidSession() {
    return !!accessToken;
  },

  getToken: () => {
    return accessToken;
  },

  updateCredentials: (clientId: string, apiKey?: string) => {
    CLIENT_ID = clientId;
    localStorage.setItem('GOOGLE_CLIENT_ID', clientId);
    if (apiKey) {
      API_KEY = apiKey;
      localStorage.setItem('GOOGLE_API_KEY', apiKey);
    }
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
          // LOGIN SUCCESS: Save token to variable and LocalStorage
          accessToken = resp.access_token;
          localStorage.setItem(TOKEN_STORAGE_KEY, resp.access_token);
          
          if (window.gapi && window.gapi.client) {
            window.gapi.client.setToken(resp);
          }
        },
      });

      // --- INITIAL CHECK: AUTO RESTORE SESSION ---
      const savedToken = localStorage.getItem(TOKEN_STORAGE_KEY);
      if (savedToken) {
          console.log("Restoring Google Session from LocalStorage...");
          accessToken = savedToken;
          // IMPORTANT: Restore token to GAPI client immediately so subsequent calls work
          if (window.gapi && window.gapi.client) {
             window.gapi.client.setToken({ access_token: savedToken });
          }
      }

      isInitialized = true;
      onInitComplete(true);

    } catch (error) {
      console.error("Failed to initialize Google Services", error);
      onInitComplete(false);
    }
  },

  signIn: (): Promise<string> => {
    return new Promise((resolve, reject) => {
      if (!CLIENT_ID) return reject("Configuration Error: Missing Client ID");
      
      const promptSignIn = () => {
         if (!tokenClient) return reject("Google Token Client not ready");
         
         // Override callback to capture response
         tokenClient.callback = (resp: any) => {
            if (resp.error) {
                reject(resp);
            } else {
                // MODIFY LOGIN: Save to LocalStorage
                accessToken = resp.access_token;
                localStorage.setItem(TOKEN_STORAGE_KEY, resp.access_token);

                if (window.gapi && window.gapi.client) {
                   window.gapi.client.setToken(resp);
                }
                resolve(resp.access_token);
            }
         };
         
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
      try {
        window.google?.accounts?.oauth2?.revoke(token.access_token, () => {});
      } catch (e) {
        console.warn("Revoke failed (token might be invalid already)");
      }
    }
    window.gapi?.client?.setToken(null);
    // MODIFY LOGOUT: Remove from LocalStorage
    localStorage.removeItem(TOKEN_STORAGE_KEY); 
    accessToken = null;
  },

  getUserInfo: async (token: string): Promise<{ name: string, email: string, picture: string }> => {
    try {
      const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.status === 401) throw new Error("UNAUTHENTICATED");
      const data = await response.json();
      return {
        name: data.name,
        email: data.email,
        picture: data.picture
      };
    } catch (error) {
      console.error("Failed to fetch user info");
      throw error;
    }
  },

  searchFolders: async (query: string): Promise<Array<{id: string, name: string}>> => {
     try {
       const q = `mimeType = 'application/vnd.google-apps.folder' and name contains '${query}' and trashed = false`;
       const response = await window.gapi.client.drive.files.list({
         q: q,
         fields: 'files(id, name)',
         spaces: 'drive',
         pageSize: 10
       });
       return response.result.files;
     } catch (error: any) {
       console.error("Folder search failed");
       if (error?.result?.error?.code === 401) throw new Error("UNAUTHENTICATED");
       return [];
     }
  },

  createSpreadsheet: async (title: string, folderId?: string): Promise<{ id: string, name: string }> => {
    try {
      if (!accessToken && window.gapi?.client?.getToken() === null) {
        throw new Error("No access token available. Please sign in.");
      }

      const response = await window.gapi.client.sheets.spreadsheets.create({
        resource: {
          properties: {
            title: title,
          },
        },
      });

      const spreadsheetId = response.result.spreadsheetId;
      
      if (folderId) {
        const file = await window.gapi.client.drive.files.get({
          fileId: spreadsheetId,
          fields: 'parents'
        });
        
        const previousParents = file.result.parents.join(',');
        
        await window.gapi.client.drive.files.update({
          fileId: spreadsheetId,
          addParents: folderId,
          removeParents: previousParents,
          fields: 'id, parents'
        });
      }
      
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
    } catch (error: any) {
      console.error("Error creating sheet");
      if (error?.result?.error?.code === 401) throw new Error("UNAUTHENTICATED");
      throw error;
    }
  },

  appendTransaction: async (spreadsheetId: string, tx: Transaction) => {
    if (!accessToken && window.gapi?.client?.getToken() === null) {
        console.warn("Skipping sync: No access token");
        throw new Error("UNAUTHENTICATED");
    }

    const itemDetails = tx.items.map(i => `${i.qty}x ${i.name} (@${i.price})`).join(", ");
    
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
    } catch (error: any) {
      console.error("Error appending row");
      if (error?.result?.error?.code === 401) throw new Error("UNAUTHENTICATED");
      throw error;
    }
  },
  
  updateTransaction: async (spreadsheetId: string, tx: Transaction) => {
    if (!accessToken && window.gapi?.client?.getToken() === null) return;
    
    try {
      const response = await window.gapi.client.sheets.spreadsheets.values.get({
        spreadsheetId: spreadsheetId,
        range: 'Sheet1!A2:A',
      });
      
      const rows = response.result.values;
      if (!rows) return;
      
      const rowIndex = rows.findIndex((r: any[]) => r[0] === tx.id);
      if (rowIndex === -1) return;
      
      const sheetRow = rowIndex + 2;
      
      const itemDetails = tx.items.map(i => `${i.qty}x ${i.name} (@${i.price})`).join(", ");
      const rowData = [
        tx.id,
        tx.date, 
        tx.storeName,
        tx.category,
        tx.type,
        tx.totalAmount,
        itemDetails
      ];

      await window.gapi.client.sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `Sheet1!A${sheetRow}:G${sheetRow}`,
        valueInputOption: 'USER_ENTERED',
        resource: { values: [rowData] }
      });
      
    } catch (error: any) {
       console.error("Update failed");
       if (error?.result?.error?.code === 401) throw new Error("UNAUTHENTICATED");
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
    } catch (error: any) {
      console.error("Error bulk appending");
      if (error?.result?.error?.code === 401) throw new Error("UNAUTHENTICATED");
      throw error;
    }
  },
  
  clearAllData: async (spreadsheetId: string) => {
    if (!accessToken && window.gapi?.client?.getToken() === null) return;
    
    try {
        await window.gapi.client.sheets.spreadsheets.values.clear({
            spreadsheetId,
            range: 'Sheet1!A2:Z10000', 
        });
    } catch (error: any) {
        console.error("Clear failed");
        if (error?.result?.error?.code === 401) throw new Error("UNAUTHENTICATED");
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
    } catch (error: any) {
        console.error("Search failed");
        if (error?.result?.error?.code === 401) throw new Error("UNAUTHENTICATED");
        return [];
    }
  },

  fetchTransactions: async (spreadsheetId: string): Promise<Transaction[]> => {
    if (!accessToken && window.gapi?.client?.getToken() === null) {
        throw new Error("Not logged in");
    }
    
    try {
      const response = await window.gapi.client.sheets.spreadsheets.values.get({
        spreadsheetId: spreadsheetId,
        range: 'Sheet1!A2:G',
      });
      
      const rows = response.result.values;
      if (!rows || rows.length === 0) return [];

      return rows.map((row: any[]) => {
        const itemsString = row[6] || "";
        const items: TransactionItem[] = [];
        
        const regex = /(\d+)x\s(.+?)\s\(@([\d.,]+)\)/g;
        let match;
        while ((match = regex.exec(itemsString)) !== null) {
            const cleanPrice = match[3].replace(/[.,]/g, '');
            items.push({
                id: Math.random().toString(36).substr(2, 9),
                qty: parseInt(match[1]),
                name: match[2],
                price: parseInt(cleanPrice) || 0
            });
        }

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
            date: row[1],
            storeName: row[2],
            category: row[3],
            type: row[4] as 'expense' | 'income',
            totalAmount: Number(row[5]),
            items: items
        };
      });

    } catch (error: any) {
      console.error("Fetch transactions failed");
      if (error?.result?.error?.code === 401) throw new Error("UNAUTHENTICATED");
      throw error;
    }
  },
  
  deleteTransactions: async (spreadsheetId: string, txIds: string[]) => {
    if (!accessToken && window.gapi?.client?.getToken() === null) return;
    if (txIds.length === 0) return;

    try {
      const response = await window.gapi.client.sheets.spreadsheets.values.get({
        spreadsheetId: spreadsheetId,
        range: 'Sheet1!A2:A',
      });

      const rows = response.result.values;
      if (!rows || rows.length === 0) return;

      const idsToDelete = new Set(txIds);
      const rowIndicesToDelete: number[] = [];

      rows.forEach((row: any[], index: number) => {
         const id = row[0];
         if (idsToDelete.has(id)) {
           rowIndicesToDelete.push(index + 1);
         }
      });

      if (rowIndicesToDelete.length === 0) return;

      rowIndicesToDelete.sort((a, b) => b - a);

      const requests = rowIndicesToDelete.map(rowIndex => ({
        deleteDimension: {
          range: {
            sheetId: 0,
            dimension: "ROWS",
            startIndex: rowIndex,
            endIndex: rowIndex + 1
          }
        }
      }));

      await window.gapi.client.sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        resource: { requests }
      });

    } catch (error: any) {
      console.error("Error deleting transactions");
      if (error?.result?.error?.code === 401) throw new Error("UNAUTHENTICATED");
      throw error;
    }
  },

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
           await window.gapi.client.sheets.spreadsheets.values.update({
              spreadsheetId,
              range: 'Settings!A1:D1',
              valueInputOption: 'RAW',
              resource: { values: [['PIN', 'CATEGORIES', 'DARK_MODE', 'THEME_COLOR']] }
          });
      }
    } catch (e: any) {
      console.error("Failed to ensure settings sheet");
      if (e?.result?.error?.code === 401) throw new Error("UNAUTHENTICATED");
    }
  },

  saveAppSettings: async (spreadsheetId: string, pin: string, categories: Category[], darkMode: boolean, themeColor: string = 'blue') => {
      try {
        await googleSheetService.ensureSettingsSheet(spreadsheetId);
        await window.gapi.client.sheets.spreadsheets.values.update({
            spreadsheetId,
            range: 'Settings!A2:D2',
            valueInputOption: 'RAW',
            resource: { values: [[pin, JSON.stringify(categories), darkMode.toString(), themeColor]] }
        });
      } catch (e: any) {
        console.error("Failed to save app settings");
        if (e?.result?.error?.code === 401) throw new Error("UNAUTHENTICATED");
      }
  },

  fetchAppSettings: async (spreadsheetId: string): Promise<{ pin?: string, categories?: Category[], darkMode?: boolean, themeColor?: string } | null> => {
      try {
          const response = await window.gapi.client.sheets.spreadsheets.values.get({
              spreadsheetId,
              range: 'Settings!A2:D2'
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
          
          const themeColor = rows[0][3] || 'blue';

          return {
              pin: rows[0][0],
              categories: cats,
              darkMode: darkMode,
              themeColor: themeColor
          };
      } catch (e: any) {
          console.warn("Settings sheet missing or empty");
          if (e?.result?.error?.code === 401) throw new Error("UNAUTHENTICATED");
          return null;
      }
  }
};
