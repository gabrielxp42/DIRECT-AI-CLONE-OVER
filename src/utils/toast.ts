import { toast } from "sonner";
import { hapticSuccess, hapticError } from "./haptic";

export const showSuccess = (message: string, options?: any) => {
  hapticSuccess();
  toast.success(message, options);
};

export const showError = (message: string, options?: any) => {
  hapticError();
  toast.error(message, options);
};

export const showLoading = (message: string) => {
  return toast.loading(message);
};

export const dismissToast = (toastId: string) => {
  toast.dismiss(toastId);
};
