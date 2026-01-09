import { Rule } from '../engine';
import { minimalProfile } from './minimal';
import { strictProfile } from './strict';
import { reactProfile } from './react';
import { vueProfile } from './vue';
import { angularProfile } from './angular';
import { backendProfile } from './backend';

export type ProfileName = 'minimal' | 'strict' | 'react' | 'vue' | 'angular' | 'backend';

export const profiles: Record<ProfileName, Rule[]> = {
  minimal: minimalProfile,
  strict: strictProfile,
  react: reactProfile,
  vue: vueProfile,
  angular: angularProfile,
  backend: backendProfile,
};

export function getProfile(name: ProfileName): Rule[] {
  return profiles[name] || profiles.minimal;
}

export { minimalProfile, strictProfile, reactProfile, vueProfile, angularProfile, backendProfile };
