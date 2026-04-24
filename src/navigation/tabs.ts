export type AppTabDefinition = {
  name: 'index' | 'record' | 'settings';
  title: string;
  label: string;
  icon: 'home' | 'mic' | 'settings';
};

export const APP_TABS: AppTabDefinition[] = [
  {
    name: 'index',
    title: 'Meetings',
    label: 'Meetings',
    icon: 'home',
  },
  {
    name: 'record',
    title: 'New Recording',
    label: 'Record',
    icon: 'mic',
  },
  {
    name: 'settings',
    title: 'Settings',
    label: 'Settings',
    icon: 'settings',
  },
];
