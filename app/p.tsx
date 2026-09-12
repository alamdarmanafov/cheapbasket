import React from 'react';
import { Redirect, useLocalSearchParams } from 'expo-router';

/**
 * `cheapmarket.app/p?id=…` is the public page for a product; when the app is
 * installed the same link opens here (universal / app links) and lands on the
 * product screen. Without an id it goes home.
 */
export default function ProductLink() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  return <Redirect href={id ? (`/product/${id}` as never) : ('/' as never)} />;
}
