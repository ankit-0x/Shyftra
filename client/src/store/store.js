// client/src/store/store.js
import { configureStore } from "@reduxjs/toolkit";
import authReducer from "./authSlice";
import authModalReducer from "./authModalSlice";
import applicationsReducer from "./applicationsSlice";
import employerShiftsReducer from "./employerShiftsSlice";
import attendanceReducer from "./attendanceSlice";
import earningsReducer from "./earningsSlice";
import profileReducer from "./profileSlice";
import adminReducer from "./adminSlice";
import walletReducer from "./walletSlice";
import disputesReducer from "./disputesSlice";
import reviewsReducer from "./reviewsSlice";
import transactionReducer from "./transactionSlice";

export const store = configureStore({
  reducer: {
    auth: authReducer,
    authModal: authModalReducer,
    applications: applicationsReducer,
    employerShifts: employerShiftsReducer,
    attendance: attendanceReducer,
    earnings: earningsReducer,
    profile: profileReducer,
    admin: adminReducer,
    wallet: walletReducer,
    disputes: disputesReducer,
    reviews: reviewsReducer,
    transactions: transactionReducer,
  },
});
