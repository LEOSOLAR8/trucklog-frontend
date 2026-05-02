import axios from "axios";
import type { TripPlanRequest, TripResponse } from "../types/trip";

// Dev (`npm run dev` at http://localhost:5173): same-origin `/api` → Vite proxies to Django :8000
const baseURL =
  import.meta.env.VITE_API_URL?.trim() ||
  (import.meta.env.DEV ? "/api" : "http://127.0.0.1:8000/api");

const API = axios.create({
  baseURL,
});

export const planTrip = async (payload: TripPlanRequest): Promise<TripResponse> => {
  try {
    const res = await API.post<TripResponse>("/trip/", payload);
    return res.data;
  } catch (e) {
    if (axios.isAxiosError(e)) {
      const body = e.response?.data as { error?: string } | undefined;
      const detail =
        typeof body?.error === "string"
          ? body.error
          : e.response?.status
            ? `Request failed (${e.response.status})`
            : "Network error — is Django running on port 8000?";
      throw new Error(detail, { cause: e });
    }
    throw e;
  }
};