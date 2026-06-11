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
import { db } from '../lib/firebase';

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
}

const FORMS_COL = 'forms';
const BOOSTER_DATA_COL = 'booster_data';
const SETTINGS_COL = 'settings';

export const firebaseService = {
  // Settings
  async getSettings(): Promise<Settings | null> {
    const sDoc = await getDoc(doc(db, SETTINGS_COL, 'global'));
    return sDoc.exists() ? sDoc.data() as Settings : null;
  },

  async updateSettings(settings: Partial<Settings>) {
    const sRef = doc(db, SETTINGS_COL, 'global');
    const sDoc = await getDoc(sRef);
    if (!sDoc.exists()) {
      await setDoc(sRef, settings);
    } else {
      await updateDoc(sRef, settings);
    }
  },

  // Forms
  async getForms(): Promise<Form[]> {
    const snapshot = await getDocs(collection(db, FORMS_COL));
    return snapshot.docs.map(d => d.data() as Form);
  },

  async saveForm(form: Form) {
    await setDoc(doc(db, FORMS_COL, form.id), form);
  },

  async deleteForm(formId: string) {
    await deleteDoc(doc(db, FORMS_COL, formId));
  },

  // Booster Data
  async getBoosterData(formId: string): Promise<BoosterData[]> {
    const q = query(collection(db, BOOSTER_DATA_COL), where('formId', '==', formId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => d.data() as BoosterData);
  },

  async getAllBoosterData(): Promise<BoosterData[]> {
    const snapshot = await getDocs(collection(db, BOOSTER_DATA_COL));
    return snapshot.docs.map(d => d.data() as BoosterData);
  },

  async saveBoosterData(data: BoosterData) {
    const ref = doc(db, BOOSTER_DATA_COL, data.id);
    const snap = await getDoc(ref);
    if (snap.exists()) {
      const existing = snap.data() as BoosterData;
      const merged: BoosterData = {
        ...existing,
        ...data,
        status: existing.status || data.status || 'WAITING FOR RECRUITMENT',
        notes: existing.notes || data.notes || '',
        contactStartedOn: existing.contactStartedOn !== undefined && existing.contactStartedOn !== null ? existing.contactStartedOn : (data.contactStartedOn || null),
        fieldOverrides: { ...(existing.fieldOverrides || {}), ...(data.fieldOverrides || {}) },
        statusHistory: existing.statusHistory || data.statusHistory || [],
        crmAccount: existing.crmAccount || data.crmAccount || '',
        lastStatusCheckedAt: existing.lastStatusCheckedAt || data.lastStatusCheckedAt || undefined,
        statusUpdatedAt: existing.statusUpdatedAt || data.statusUpdatedAt || undefined,
        discord: existing.discord || data.discord || '',
        telegram: existing.telegram || data.telegram || '',
        email: existing.email || data.email || '',
        games: existing.games || data.games || '',
        workingHours: existing.workingHours || data.workingHours || '',
        region: existing.region || data.region || '',
        fields: { ...(existing.fields || {}), ...(data.fields || {}) }
      };
      await setDoc(ref, merged);
    } else {
      await setDoc(ref, data);
    }
  },

  async markStatusChecked(id: string) {
    const ref = doc(db, BOOSTER_DATA_COL, id);
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
  },

  async updateBoosterStatus(id: string, formId: string, status?: string, notes?: string, crmAccount?: string) {
    const ref = doc(db, BOOSTER_DATA_COL, id);
    const snap = await getDoc(ref);
    const now = new Date().toISOString();
    
    // Trim CRM account if provided
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

      if (trimmedCrm === undefined && currentData.crmAccount) {
        historyEntry.crmAccount = currentData.crmAccount;
      }

      const updates: any = { 
        updatedAt: now,
        statusUpdatedAt: now,
        statusHistory: shouldAddNewHistory ? [...history, historyEntry] : history,
        // Reset check time if status changes
        ...(shouldAddNewHistory && status ? { lastStatusCheckedAt: null } : {})
      };
      if (status) updates.status = status;
      if (notes !== undefined) updates.notes = notes;
      if (trimmedCrm !== undefined) updates.crmAccount = trimmedCrm;
      
      await updateDoc(ref, updates);
    }
  },

  async updateContactStart(id: string, formId: string, contactType: string) {
    const ref = doc(db, BOOSTER_DATA_COL, id);
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
  }
};
