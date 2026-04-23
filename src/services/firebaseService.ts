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
  games?: string;
  workingHours?: string;
  region?: string;
  fieldOverrides?: Record<string, any>;
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
    await setDoc(doc(db, BOOSTER_DATA_COL, data.id), data);
  },

  async updateBoosterStatus(id: string, formId: string, status?: string, notes?: string, crmAccount?: string) {
    const ref = doc(db, BOOSTER_DATA_COL, id);
    const snap = await getDoc(ref);
    const now = new Date().toISOString();
    
    const historyEntry: any = {
      status: status || 'WAITING FOR RECRUITMENT',
      timestamp: now,
    };
    if (crmAccount !== undefined) historyEntry.crmAccount = crmAccount;

    if (!snap.exists()) {
      const newDoc: any = {
        id,
        formId,
        status: status || 'WAITING FOR RECRUITMENT',
        notes: notes || '',
        updatedAt: now,
        contactStartedOn: null,
        statusHistory: [historyEntry],
      };
      if (crmAccount !== undefined) newDoc.crmAccount = crmAccount;
      await setDoc(ref, newDoc);
    } else {
      const currentData = snap.data() as BoosterData;
      const history = currentData.statusHistory || [];
      
      const lastEntry = history[history.length - 1];
      const shouldAddNewHistory = !lastEntry || lastEntry.status !== status;

      const updates: any = { 
        updatedAt: now,
        statusHistory: shouldAddNewHistory ? [...history, historyEntry] : history
      };
      if (status) updates.status = status;
      if (notes !== undefined) updates.notes = notes;
      if (crmAccount !== undefined) updates.crmAccount = crmAccount;
      
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
