import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  query, 
  where,
  onSnapshot,
  updateDoc,
  deleteDoc,
  collectionGroup
} from 'firebase/firestore';
import { db, auth } from '../lib/firebase';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export interface Form {
  id: string;
  title: string;
  type: 'LOCAL' | 'JOTFORM';
  schema?: string[];
  createdAt?: string;
}

export interface BoosterData {
  id: string;
  formId: string;
  status: string;
  notes: string;
  contactStartedOn: string | null;
  createdAt: string;
  statusHistory?: { status: string; timestamp: string; crmAccount?: string }[];
  crmAccount?: string;
  telegram?: string;
  discord?: string;
  email?: string;
   games?: string;
  workingHours?: string;
  region?: string;
  fieldOverrides?: Record<string, any>;
  lastStatusCheckedAt?: string;
  statusUpdatedAt?: string;
  updatedAt: string;
  fields?: Record<string, any>;
  syncBatchId?: string;
  isArchived?: boolean;
}

export interface Settings {
  formOrder: string[];
  columnRenames: Record<string, string>;
  formRenames: Record<string, string>;
  ignoredForms: string[];
  manualForms: string[];
  blacklistForms: string[];
  fieldSettings: Record<string, any>;
  jotformApiKey?: string;
  availableGames?: string[];
  lastSyncBatchId?: string;
}

const FORMS_COL = 'forms';
const BOOSTER_DATA_COL = 'booster_data';
const SETTINGS_COL = 'settings';

export const firebaseService = {
  // Settings
  async getSettings(): Promise<Settings | null> {
    try {
      const sDoc = await getDoc(doc(db, SETTINGS_COL, 'global'));
      return sDoc.exists() ? sDoc.data() as Settings : null;
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, `${SETTINGS_COL}/global`);
      return null;
    }
  },

  async updateSettings(settings: Partial<Settings>) {
    const sRef = doc(db, SETTINGS_COL, 'global');
    try {
      const sDoc = await getDoc(sRef);
      if (!sDoc.exists()) {
        await setDoc(sRef, settings);
      } else {
        await updateDoc(sRef, settings);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `${SETTINGS_COL}/global`);
    }
  },

  // Forms
  async getForms(): Promise<Form[]> {
    try {
      const snapshot = await getDocs(collection(db, FORMS_COL));
      return snapshot.docs.map(d => d.data() as Form);
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, FORMS_COL);
      return [];
    }
  },

  async saveForm(form: Form) {
    try {
      await setDoc(doc(db, FORMS_COL, form.id), form);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `${FORMS_COL}/${form.id}`);
    }
  },

  async deleteForm(formId: string) {
    try {
      await deleteDoc(doc(db, FORMS_COL, formId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `${FORMS_COL}/${formId}`);
    }
  },

  // Booster Data
  async getBoosterData(formId: string, filter: 'ACTIVE' | 'ARCHIVED' | 'ALL' = 'ACTIVE'): Promise<BoosterData[]> {
    try {
      let q;
      // Note: We avoid composite indexes by fetching by formId and filtering isArchived in memory
      // if it's the 'ACTIVE' filter. Equality + Equality (ARCHIVED) is usually fine.
      if (filter === 'ARCHIVED') {
        q = query(collection(db, BOOSTER_DATA_COL), 
          where('formId', '==', formId), 
          where('isArchived', '==', true)
        );
      } else {
        q = query(collection(db, BOOSTER_DATA_COL), where('formId', '==', formId));
      }

      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(d => d.data() as BoosterData);
      
      if (filter === 'ACTIVE') {
        return data.filter(d => d.isArchived !== true);
      }
      return data;
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, BOOSTER_DATA_COL);
      return [];
    }
  },

  async getAllBoosterData(filter: 'ACTIVE' | 'ARCHIVED' | 'ALL' = 'ACTIVE'): Promise<BoosterData[]> {
    try {
      let q;
      if (filter === 'ARCHIVED') {
        q = query(collection(db, BOOSTER_DATA_COL), where('isArchived', '==', true));
      } else {
        q = collection(db, BOOSTER_DATA_COL);
      }
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(d => d.data() as BoosterData);
      
      if (filter === 'ACTIVE') {
        return data.filter(d => d.isArchived !== true);
      }
      return data;
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, BOOSTER_DATA_COL);
      return [];
    }
  },

  async getArchivedBoosterData(): Promise<BoosterData[]> {
    try {
      const q = query(collection(db, BOOSTER_DATA_COL), where('isArchived', '==', true));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(d => d.data() as BoosterData);
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, BOOSTER_DATA_COL);
      return [];
    }
  },

  async saveBoosterData(data: BoosterData) {
    try {
      await setDoc(doc(db, BOOSTER_DATA_COL, data.id), data);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `${BOOSTER_DATA_COL}/${data.id}`);
    }
  },

  async archiveBooster(id: string, isArchived: boolean) {
    try {
      const ref = doc(db, BOOSTER_DATA_COL, id);
      await updateDoc(ref, { 
        isArchived,
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `${BOOSTER_DATA_COL}/${id}`);
    }
  },

  async markStatusChecked(id: string) {
    const ref = doc(db, BOOSTER_DATA_COL, id);
    try {
      const snap = await getDoc(ref);
      const now = new Date().toISOString();
      
      const historyEntry = {
        status: 'CHECKED',
        timestamp: now,
      };

      if (snap.exists()) {
        const currentData = snap.data() as BoosterData;
        const history = currentData.statusHistory || [];
        await updateDoc(ref, { 
          lastStatusCheckedAt: now,
          statusHistory: [...history, historyEntry]
        });
      } else {
        await updateDoc(ref, { 
          lastStatusCheckedAt: now 
        });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `${BOOSTER_DATA_COL}/${id}`);
    }
  },

  async updateBoosterStatus(id: string, formId: string, status?: string, notes?: string, crmAccount?: string) {
    const ref = doc(db, BOOSTER_DATA_COL, id);
    try {
      const snap = await getDoc(ref);
      const now = new Date().toISOString();
      
      const trimmedCrm = crmAccount?.trim();
      
      const historyEntry: any = {
        status: status || 'WAITING FOR RECRUITMENT',
        timestamp: now,
      };
      if (trimmedCrm !== undefined) historyEntry.crmAccount = trimmedCrm;

      if (!snap.exists()) {
        const newDoc: any = {
          id,
          formId,
          status: status || 'WAITING FOR RECRUITMENT',
          notes: notes || '',
          updatedAt: now,
          statusUpdatedAt: now,
          contactStartedOn: null,
          statusHistory: [historyEntry],
        };
        if (trimmedCrm !== undefined) newDoc.crmAccount = trimmedCrm;
        await setDoc(ref, newDoc);
      } else {
        const currentData = snap.data() as BoosterData;
        const history = currentData.statusHistory || [];
        
        const lastEntry = history[history.length - 1];
        const shouldAddNewHistory = !lastEntry || lastEntry.status !== status;

        const updates: any = { 
          updatedAt: now,
          statusUpdatedAt: now,
          statusHistory: shouldAddNewHistory ? [...history, historyEntry] : history,
          ...(shouldAddNewHistory && status ? { lastStatusCheckedAt: null } : {})
        };
        if (status) updates.status = status;
        if (notes !== undefined) updates.notes = notes;
        if (trimmedCrm !== undefined) updates.crmAccount = trimmedCrm;
        
        await updateDoc(ref, updates);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `${BOOSTER_DATA_COL}/${id}`);
    }
  },

  async updateContactStart(id: string, formId: string, contactType: string) {
    const ref = doc(db, BOOSTER_DATA_COL, id);
    try {
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        await setDoc(ref, {
          id,
          formId,
          status: 'WAITING FOR RECRUITMENT',
          notes: '',
          contactStartedOn: contactType,
          updatedAt: new Date().toISOString()
        });
      } else {
        await updateDoc(ref, { contactStartedOn: contactType });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `${BOOSTER_DATA_COL}/${id}`);
    }
  },

  async boosterExists(id: string): Promise<boolean> {
    try {
      const sDoc = await getDoc(doc(db, BOOSTER_DATA_COL, id));
      return sDoc.exists();
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, `${BOOSTER_DATA_COL}/${id}`);
      return false;
    }
  },

  async getBoostersByBatch(batchId: string): Promise<BoosterData[]> {
    try {
      const q = query(collection(db, BOOSTER_DATA_COL), where('syncBatchId', '==', batchId));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(d => d.data() as BoosterData);
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, BOOSTER_DATA_COL);
      return [];
    }
  },

  async deleteBooster(id: string) {
    try {
      await deleteDoc(doc(db, BOOSTER_DATA_COL, id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `${BOOSTER_DATA_COL}/${id}`);
    }
  }
};
