
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
  // SHA-256 Hash of '123456'
  pin: '8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92'
};

export const APP_THEMES = [
  { id: 'blue', name: 'Default Blue', hex: '#007AFF' },
  { id: 'purple', name: 'Royal Purple', hex: '#AF52DE' },
  { id: 'green', name: 'Fresh Green', hex: '#34C759' },
  { id: 'orange', name: 'Sunset Orange', hex: '#FF9500' },
  { id: 'pink', name: 'Hot Pink', hex: '#FF2D55' },
  { id: 'teal', name: 'Ocean Teal', hex: '#30B0C7' },
  { id: 'indigo', name: 'Indigo', hex: '#5856D6' },
  { id: 'red', name: 'Red', hex: '#FF3B30' },
];