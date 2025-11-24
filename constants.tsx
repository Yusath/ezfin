import React from 'react';
import { Category } from './types';

export const DEFAULT_CATEGORIES: Category[] = [
  { id: '1', name: 'Makanan', icon: '🍔', type: 'expense' },
  { id: '2', name: 'Transportasi', icon: '🚌', type: 'expense' },
  { id: '3', name: 'Hiburan', icon: '🎬', type: 'expense' },
  { id: '4', name: 'Pendidikan', icon: '📚', type: 'expense' },
  { id: '5', name: 'Belanja', icon: '🛍️', type: 'expense' },
  { id: '6', name: 'Uang Saku', icon: '💸', type: 'income' },
  { id: '7', name: 'Freelance', icon: '💻', type: 'income' },
];

export const DEFAULT_USER_PROFILE = {
  name: 'Orang Pintar',
  // Plain blue-ish avatar with initials
  avatarUrl: 'https://ui-avatars.com/api/?name=Orang+Pintar&background=007AFF&color=ffffff&size=128&bold=true',
  pin: '123456'
};