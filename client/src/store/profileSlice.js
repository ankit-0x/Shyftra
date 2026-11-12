import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import toast from "react-hot-toast";
import api from "../api/axios";
import { verifyEmailChange } from "./authSlice";

export const fetchProfile = createAsyncThunk(
  "profile/fetch",
  async (_, { rejectWithValue }) => {
    try {
      const res = await api.get("/api/profile");
      return res.data;
    } catch (err) {
      return rejectWithValue(
        err.response?.data?.error || "Failed to load profile",
      );
    }
  },
);

export const updateProfile = createAsyncThunk(
  "profile/update",
  async (data, { rejectWithValue }) => {
    try {
      const res = await api.put("/api/profile", data);
      toast.success("Profile updated!");
      return res.data.profile;
    } catch (err) {
      const message = err.response?.data?.error || "Failed to update profile";
      toast.error(message);
      return rejectWithValue(message);
    }
  },
);

export const uploadAvatar = createAsyncThunk(
  "profile/uploadAvatar",
  async (file, { rejectWithValue }) => {
    try {
      const formData = new FormData();
      formData.append("file", file); // MUST match Multer's upload.single("file") field name
      const res = await api.post("/api/uploads/avatar", formData);
      toast.success("Avatar updated!");
      return res.data.avatarUrl;
    } catch (err) {
      const message = err.response?.data?.error || "Failed to upload avatar";
      toast.error(message);
      return rejectWithValue(message);
    }
  },
);

export const uploadVerificationDoc = createAsyncThunk(
  "profile/uploadVerificationDoc",
  async (file, { rejectWithValue }) => {
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await api.post("/api/uploads/verification-doc", formData);
      toast.success("Document submitted for review!"); // matches the backend's real wording
      return res.data.verificationStatus;
    } catch (err) {
      const message = err.response?.data?.error || "Failed to upload document";
      toast.error(message);
      return rejectWithValue(message);
    }
  },
);

const profileSlice = createSlice({
  name: "profile",
  initialState: {
    data: null,
    status: "idle",
  },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchProfile.pending, (state) => {
        state.status = "loading";
      })
      .addCase(fetchProfile.fulfilled, (state, action) => {
        state.data = action.payload;
        state.status = "succeeded";
      })
      .addCase(fetchProfile.rejected, (state) => {
        state.status = "failed";
      })
      .addCase(updateProfile.fulfilled, (state, action) => {
        if (state.data) state.data.profile = action.payload;
      })
      .addCase(uploadAvatar.fulfilled, (state, action) => {
        if (state.data) state.data.avatarUrl = action.payload;
      })
      .addCase(uploadVerificationDoc.fulfilled, (state, action) => {
        if (state.data) state.data.verificationStatus = action.payload;
      })
      .addCase(verifyEmailChange.fulfilled, (state, action) => {
        if (state.data) state.data.email = action.payload.email;
      });
  },
});

export default profileSlice.reducer;
