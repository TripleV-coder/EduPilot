"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface OnboardingState {
    currentStep: number;
    completedSteps: number[];

    // Step 1: School Config
    schoolConfig: {
        name?: string;
        address?: string;
        city?: string;
        phone?: string;
        email?: string;
        type?: string;
        level?: string;
        logo?: string;
    };

    // Step 2: Structure
    structure: {
        academicYear?: {
            name: string;
            startDate: string;
            endDate: string;
        };
        classLevels: Array<{
            name: string;
            code: string;
            order: number;
        }>;
        classes: Array<{
            name: string;
            levelCode: string;
            capacity: number;
        }>;
    };

    // Step 3-5: Import Stats
    importStats: {
        teachers: number;
        students: number;
        parents: number;
    };

    // Actions
    setCurrentStep: (step: number) => void;
    markStepComplete: (step: number) => void;
    setSchoolConfig: (config: Partial<OnboardingState["schoolConfig"]>) => void;
    setStructure: (structure: Partial<OnboardingState["structure"]>) => void;
    updateImportStats: (type: "teachers" | "students" | "parents", count: number) => void;
    nextStep: () => void;
    previousStep: () => void;
    goToStep: (step: number) => void;
    reset: () => void;
}

const initialState = {
    currentStep: 0,
    completedSteps: [],
    schoolConfig: {},
    structure: {
        classLevels: [],
        classes: [],
    },
    importStats: {
        teachers: 0,
        students: 0,
        parents: 0,
    },
};

export const useOnboarding = create<OnboardingState>()(
    persist(
        (set, _get) => ({
            ...initialState,

            setCurrentStep: (step) => set({ currentStep: step }),

            markStepComplete: (step) =>
                set((state) => ({
                    completedSteps: [...new Set([...state.completedSteps, step])],
                })),

            setSchoolConfig: (config) =>
                set((state) => ({
                    schoolConfig: { ...state.schoolConfig, ...config },
                })),

            setStructure: (structure) =>
                set((state) => ({
                    structure: { ...state.structure, ...structure },
                })),

            updateImportStats: (type, count) =>
                set((state) => ({
                    importStats: { ...state.importStats, [type]: count },
                })),

            nextStep: () =>
                set((state) => {
                    const nextStep = Math.min(state.currentStep + 1, 5);
                    return {
                        currentStep: nextStep,
                        completedSteps: [...new Set([...state.completedSteps, state.currentStep])],
                    };
                }),

            previousStep: () =>
                set((state) => ({
                    currentStep: Math.max(state.currentStep - 1, 0),
                })),

            goToStep: (step) => set({ currentStep: step }),

            reset: () => set(initialState),
        }),
        {
            name: "edupilot-onboarding",
        }
    )
);
