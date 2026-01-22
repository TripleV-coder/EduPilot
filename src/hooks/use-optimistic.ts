import { useState, useCallback, useRef } from "react";

/**
 * Optimistic update hook for React
 * Allows immediate UI updates while the actual API call happens in the background
 */
export function useOptimisticUpdate<T, E = unknown>() {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<E | null>(null);
  const pendingUpdate = useRef<{ previousData: T | null; timestamp: number } | null>(null);

  /**
   * Execute an optimistic update
   * @param apiCall - The actual API call
   * @param optimisticUpdate - Function to update state immediately
   * @param options - Configuration options
   */
  const executeOptimisticUpdate = useCallback(
    async (
      apiCall: () => Promise<T>,
      optimisticUpdate: (currentData: T | null) => T,
      options: {
        onSuccess?: (data: T) => void;
        onError?: (error: E, previousData: T | null) => void;
        rollbackDelay?: number; // ms before rollback (default: 3000)
      } = {}
    ): Promise<T | null> => {
      const { onSuccess, onError, rollbackDelay = 3000 } = options;

      setLoading(true);
      setError(null);

      // Store current state for potential rollback
      pendingUpdate.current = {
        previousData: data,
        timestamp: Date.now(),
      };

      // Apply optimistic update
      const optimisticData = optimisticUpdate(data);
      setData(optimisticData);

      try {
        // Make actual API call
        const result = await apiCall();

        // Update with real data
        setData(result);
        setLoading(false);

        // Clear pending update
        pendingUpdate.current = null;

        onSuccess?.(result);
        return result;
      } catch (err) {
        // Handle error - rollback to previous state
        setError(err as E);
        setLoading(false);

        // Rollback after delay (allows user to see the error toast first)
        setTimeout(() => {
          if (pendingUpdate.current) {
            setData(pendingUpdate.current.previousData);
            pendingUpdate.current = null;
          }
        }, rollbackDelay);

        onError?.(err as E, pendingUpdate.current?.previousData || null);
        return null;
      }
    },
    [data]
  );

  /**
   * Reset state to initial values
   */
  const reset = useCallback(() => {
    setData(null);
    setLoading(false);
    setError(null);
    pendingUpdate.current = null;
  }, []);

  /**
   * Set data directly (for non-optimistic updates)
   */
  const setDirectData = useCallback((newData: T | null) => {
    setData(newData);
  }, []);

  return {
    data,
    setData: setDirectData,
    loading,
    error,
    executeOptimisticUpdate,
    reset,
    isPending: loading && pendingUpdate.current !== null,
  };
}

/**
 * Hook for managing list data with optimistic add/remove/update
 */
export function useOptimisticList<T extends { id: string }>() {
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);

  /**
   * Optimistically add an item to the list
   */
  const addItem = useCallback(
    async (
      apiCall: () => Promise<T>,
      tempItem?: T // Optional temporary item to show immediately
    ): Promise<T | null> => {
      setLoading(true);
      setError(null);

      // Create temp item if not provided
      const tempId = `temp-${Date.now()}`;
      const pendingItem = tempItem || {
        id: tempId,
        _isOptimistic: true,
      } as T & { _isOptimistic: boolean };

      // Optimistically add to list
      setItems((prev) => [...prev, pendingItem]);

      try {
        const result = await apiCall();

        // Replace temp item with real item
        setItems((prev) =>
          prev.map((item) => (item.id === tempId ? result : item))
        );
        setLoading(false);
        return result;
      } catch (err) {
        // Remove temp item on error
        setItems((prev) => prev.filter((item) => item.id !== tempId));
        setError(err);
        setLoading(false);
        return null;
      }
    },
    []
  );

  /**
   * Optimistically remove an item from the list
   */
  const removeItem = useCallback(
    async (itemId: string, apiCall: () => Promise<void>): Promise<boolean> => {
      setLoading(true);
      setError(null);

      // Store item for potential rollback
      const itemToRemove = items.find((item) => item.id === itemId);

      // Optimistically remove
      setItems((prev) => prev.filter((item) => item.id !== itemId));

      try {
        await apiCall();
        setLoading(false);
        return true;
      } catch (err) {
        // Restore item on error
        if (itemToRemove) {
          setItems((prev) => [...prev, itemToRemove]);
        }
        setError(err);
        setLoading(false);
        return false;
      }
    },
    [items]
  );

  /**
   * Optimistically update an item in the list
   */
  const updateItem = useCallback(
    async (
      itemId: string,
      apiCall: () => Promise<T>,
      optimisticUpdate: Partial<T>
    ): Promise<T | null> => {
      setLoading(true);
      setError(null);

      // Store original item for rollback
      const originalItem = items.find((item) => item.id === itemId);

      // Optimistically update
      setItems((prev) =>
        prev.map((item) =>
          item.id === itemId ? { ...item, ...optimisticUpdate } : item
        )
      );

      try {
        const result = await apiCall();

        // Update with real data
        setItems((prev) =>
          prev.map((item) => (item.id === itemId ? result : item))
        );
        setLoading(false);
        return result;
      } catch (err) {
        // Restore original item
        if (originalItem) {
          setItems((prev) =>
            prev.map((item) => (item.id === itemId ? originalItem : item))
          );
        }
        setError(err);
        setLoading(false);
        return null;
      }
    },
    [items]
  );

  /**
   * Set items directly (for initial fetch)
   */
  const setItemsDirect = useCallback((newItems: T[]) => {
    setItems(newItems);
  }, []);

  return {
    items,
    setItems: setItemsDirect,
    loading,
    error,
    addItem,
    removeItem,
    updateItem,
  };
}

/**
 * Hook for handling retry logic with exponential backoff
 */
export function useRetry<T>(
  apiCall: () => Promise<T>,
  options: {
    maxRetries?: number;
    initialDelay?: number;
    maxDelay?: number;
    backoffMultiplier?: number;
  } = {}
) {
  const {
    maxRetries = 3,
    initialDelay = 1000,
    maxDelay = 10000,
    backoffMultiplier = 2,
  } = options;

  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);
  const [attempt, setAttempt] = useState(0);

  const executeWithRetry = useCallback(
    async (): Promise<T | null> => {
      setLoading(true);
      setError(null);
      setAttempt(1);

      let lastError: unknown;
      let currentDelay = initialDelay;

      for (let i = 0; i <= maxRetries; i++) {
        try {
          const result = await apiCall();
          setData(result);
          setLoading(false);
          return result;
        } catch (err) {
          lastError = err;

          if (i < maxRetries) {
            // Wait before retrying
            await new Promise((resolve) => setTimeout(resolve, currentDelay));
            currentDelay = Math.min(currentDelay * backoffMultiplier, maxDelay);
            setAttempt(i + 2);
          }
        }
      }

      setError(lastError);
      setLoading(false);
      return null;
    },
    [apiCall, maxRetries, initialDelay, maxDelay, backoffMultiplier]
  );

  const reset = useCallback(() => {
    setData(null);
    setError(null);
    setLoading(false);
    setAttempt(0);
  }, []);

  return {
    data,
    setData,
    error,
    loading,
    attempt,
    executeWithRetry,
    reset,
  };
}

const optimisticHooks = {
  useOptimisticUpdate,
  useOptimisticList,
  useRetry,
};

export default optimisticHooks;
