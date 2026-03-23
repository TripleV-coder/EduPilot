export const fetcher = async (url: string) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25_000);

    const res = await fetch(url, {
        signal: controller.signal,
        headers: { Accept: "application/json" },
    }).finally(() => clearTimeout(timeout));
    if (!res.ok) {
        let message = 'Une erreur est survenue lors de la récupération des données.';
        try {
            const errorData = await res.json();
            message = errorData.error || message;
        } catch (e) {
            // If response is not JSON
        }
        const error = new Error(message);
        throw error;
    }
    return res.json();
};
