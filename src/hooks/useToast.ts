import { useToastStore } from '../store/useToastStore';

export const useToast = () => {
    const { success, error, warning, info } = useToastStore();

    return {
        success,
        error,
        warning,
        info
    };
};
