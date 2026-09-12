import React from 'react';
import { Redirect, useLocalSearchParams } from 'expo-router';

/** `cheapmarket.app/r?code=…` — an invite link. Lands on the points screen with the code filled in. */
export default function ReferralLink() {
  const { code } = useLocalSearchParams<{ code?: string }>();
  return <Redirect href={{ pathname: '/referral', params: code ? { code } : {} } as never} />;
}
