import { useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../auth/AuthProvider';
import { atlas } from '../lib/atlas';

const PREF_KEY = 'app.view';

const DEFAULTS = {
  sortMode: 'az',
  viewMode: 'cards',
  favoritesFirst: false,
  favorites: [],
};

export function useAppViewPrefs() {
  const { session } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();
  const debounceRef = useRef(null);

  const queryKey = ['user-preferences', PREF_KEY, token];

  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      try {
        return await atlas.profile.getPreference(PREF_KEY, token);
      } catch (e) {
        if (e.status === 404) return { value: DEFAULTS };
        throw e;
      }
    },
    enabled: Boolean(token),
    staleTime: 300_000,
  });

  const mutation = useMutation({
    mutationFn: (value) => atlas.profile.setPreference(PREF_KEY, value, token),
  });

  const prefs = data ? { ...DEFAULTS, ...data.value } : DEFAULTS;

  function saveDebounced(next) {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      mutation.mutate(next);
    }, 500);
  }

  function update(changes) {
    const next = { ...prefs, ...changes };
    queryClient.setQueryData(queryKey, { value: next });
    saveDebounced(next);
  }

  return {
    sortMode: prefs.sortMode,
    viewMode: prefs.viewMode,
    favoritesFirst: prefs.favoritesFirst,
    favorites: prefs.favorites,
    isLoading,
    setSortMode: (mode) => update({ sortMode: mode }),
    setViewMode: (mode) => update({ viewMode: mode }),
    toggleFavoritesFirst: () => update({ favoritesFirst: !prefs.favoritesFirst }),
    toggleFavorite: (key) =>
      update({
        favorites: prefs.favorites.includes(key)
          ? prefs.favorites.filter((k) => k !== key)
          : [...prefs.favorites, key],
      }),
    isFavorite: (key) => prefs.favorites.includes(key),
  };
}
