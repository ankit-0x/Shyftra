// client/src/utils/actionExecutors.js
import { store } from "../store/store";
import { applyToShift } from "../store/applicationsSlice";
import { createShift } from "../store/employerShiftsSlice";

export const actionExecutors = {
  // REAL now — this is the one wired all the way to Day 10's backend.
  apply: (data) => {
    store.dispatch(applyToShift(data));
  },

  post_shift: (data) => {
    store.dispatch(createShift(data));
  },
};
