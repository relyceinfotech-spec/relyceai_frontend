import { collection, getDocs, addDoc, updateDoc, doc, deleteDoc, query, where } from 'firebase/firestore';
import { db } from './firebaseConfig';

export const saveCoupon = async (couponData) => {
  try {
    const couponsRef = collection(db, 'coupons');
    const docRef = await addDoc(couponsRef, {
      ...couponData,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    return { success: true, id: docRef.id, message: 'Coupon saved successfully' };
  } catch {
    return { success: false, message: 'Failed to save coupon' };
  }
};

export const getAllCoupons = async () => {
  try {
    const couponsRef = collection(db, 'coupons');
    const snapshot = await getDocs(couponsRef);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch {
    return [];
  }
};

export const updateCoupon = async (couponId, updateData) => {
  try {
    const couponRef = doc(db, 'coupons', couponId);
    await updateDoc(couponRef, { ...updateData, updatedAt: new Date() });
    return { success: true, message: 'Coupon updated successfully' };
  } catch {
    return { success: false, message: 'Failed to update coupon' };
  }
};

export const deleteCoupon = async (couponId) => {
  try {
    const couponRef = doc(db, 'coupons', couponId);
    await deleteDoc(couponRef);
    return { success: true, message: 'Coupon deleted successfully' };
  } catch {
    return { success: false, message: 'Failed to delete coupon' };
  }
};

export const validateCoupon = async (couponCode) => {
  try {
    const couponsRef = collection(db, 'coupons');
    const q = query(
      couponsRef,
      where('code', '==', couponCode.toUpperCase()),
      where('active', '==', true)
    );
    const snapshot = await getDocs(q);
    if (snapshot.empty) return null;
    const doc = snapshot.docs[0];
    return { id: doc.id, ...doc.data() };
  } catch {
    return null;
  }
};

export const toggleCouponStatus = async (couponId, active) => {
  try {
    const couponRef = doc(db, 'coupons', couponId);
    await updateDoc(couponRef, { active, updatedAt: new Date() });
    return { success: true, message: 'Coupon status updated successfully' };
  } catch {
    return { success: false, message: 'Failed to update coupon status' };
  }
};