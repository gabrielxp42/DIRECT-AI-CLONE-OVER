import { toast } from "sonner";
import { hapticSuccess, hapticError } from "./haptic";

export const showSuccess = (message: string) => {
  hapticSuccess();
  toast.success(message);
};

export const showError = (message: string) => {
  hapticError();
  toast.error(message);
};

export const showLoading = (message: string) => {
  return toast.loading(message);
};

export const dismissToast = (toastId: string) => {
  toast.dismiss(toastId);
};
