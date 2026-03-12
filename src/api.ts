import { db, collection, doc, setDoc, getDoc, getDocs, updateDoc, deleteDoc, query, orderBy } from './firebase';
import { Member, Payment } from "./types";

export const api = {
  members: {
    list: async () => {
      const q = query(collection(db, 'members'), orderBy('lastName', 'asc'));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => doc.data() as Member);
    },
    create: async (member: Member) => {
      await setDoc(doc(db, 'members', member.id), member);
      return member;
    },
    update: async (id: string, member: Member) => {
      await updateDoc(doc(db, 'members', id), member as any);
      return member;
    },
    delete: async (id: string) => {
      await deleteDoc(doc(db, 'members', id));
    }
  },
  payments: {
    list: async () => {
      const q = query(collection(db, 'payments'), orderBy('date', 'desc'));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => doc.data() as Payment);
    },
    create: async (payment: Payment) => {
      await setDoc(doc(db, 'payments', payment.paymentId), payment);
      return payment;
    },
    update: async (id: string, payment: Payment) => {
      await updateDoc(doc(db, 'payments', id), payment as any);
      return payment;
    }
  }
};
