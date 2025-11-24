import { Transaction, UserProfile, Category } from '../types';
import { DEFAULT_CATEGORIES } from '../constants';

const DB_NAME = 'EZFinDB';
const DB_VERSION = 1;

export const DB_STORES = {
  TRANSACTIONS: 'transactions',
  USER: 'user',
  CATEGORIES: 'categories'
};

class EZFinDatabase {
  private db: IDBDatabase | null = null;

  private open(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      if (this.db) {
        resolve(this.db);
        return;
      }

      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        // Create Stores if they don't exist
        if (!db.objectStoreNames.contains(DB_STORES.TRANSACTIONS)) {
          db.createObjectStore(DB_STORES.TRANSACTIONS, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(DB_STORES.USER)) {
          db.createObjectStore(DB_STORES.USER, { keyPath: 'key' });
        }
        if (!db.objectStoreNames.contains(DB_STORES.CATEGORIES)) {
          db.createObjectStore(DB_STORES.CATEGORIES, { keyPath: 'id' });
        }
      };

      request.onsuccess = (event) => {
        this.db = (event.target as IDBOpenDBRequest).result;
        resolve(this.db);
      };

      request.onerror = (event) => {
        console.error("IndexedDB error:", (event.target as IDBOpenDBRequest).error);
        reject((event.target as IDBOpenDBRequest).error);
      };
    });
  }

  // --- USER PROFILE ---
  async getUser(): Promise<UserProfile | null> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(DB_STORES.USER, 'readonly');
      const store = transaction.objectStore(DB_STORES.USER);
      const request = store.get('profile');

      request.onsuccess = () => {
        resolve(request.result ? request.result.data : null);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async saveUser(user: UserProfile): Promise<void> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(DB_STORES.USER, 'readwrite');
      const store = transaction.objectStore(DB_STORES.USER);
      // We store user with a fixed key 'profile'
      const request = store.put({ key: 'profile', data: user });

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // --- TRANSACTIONS ---
  async getAllTransactions(): Promise<Transaction[]> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(DB_STORES.TRANSACTIONS, 'readonly');
      const store = transaction.objectStore(DB_STORES.TRANSACTIONS);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  async addTransaction(tx: Transaction): Promise<void> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(DB_STORES.TRANSACTIONS, 'readwrite');
      const store = transaction.objectStore(DB_STORES.TRANSACTIONS);
      const request = store.put(tx);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async bulkAddTransactions(transactions: Transaction[]): Promise<void> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(DB_STORES.TRANSACTIONS, 'readwrite');
      const store = transaction.objectStore(DB_STORES.TRANSACTIONS);
      
      let processed = 0;
      transactions.forEach(tx => {
        store.put(tx);
        processed++;
      });

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  // --- CATEGORIES ---
  async getAllCategories(): Promise<Category[]> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(DB_STORES.CATEGORIES, 'readonly');
      const store = transaction.objectStore(DB_STORES.CATEGORIES);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  async saveCategory(category: Category): Promise<void> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(DB_STORES.CATEGORIES, 'readwrite');
      const store = transaction.objectStore(DB_STORES.CATEGORIES);
      const request = store.put(category);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async deleteCategory(id: string): Promise<void> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(DB_STORES.CATEGORIES, 'readwrite');
      const store = transaction.objectStore(DB_STORES.CATEGORIES);
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async initDefaultsIfNeeded(defaultUser: UserProfile): Promise<{ user: UserProfile, categories: Category[] }> {
    const db = await this.open();
    
    // Check Categories
    let categories = await this.getAllCategories();
    if (categories.length === 0) {
      const tx = db.transaction(DB_STORES.CATEGORIES, 'readwrite');
      const store = tx.objectStore(DB_STORES.CATEGORIES);
      DEFAULT_CATEGORIES.forEach(cat => store.put(cat));
      categories = DEFAULT_CATEGORIES;
    }

    // Check User
    let user = await this.getUser();
    if (!user) {
      await this.saveUser(defaultUser);
      user = defaultUser;
    }

    return { user, categories };
  }
}

export const dbService = new EZFinDatabase();