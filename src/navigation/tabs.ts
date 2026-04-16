export type AppTabDefinition = {
  name: 'index' | 'record' | 'settings' | 'layers';
  title: string;
  label: string;
  icon: 'home' | 'mic' | 'settings' | 'layers';
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
  {
    name: 'layers',
    title: 'Layers',
    label: 'Layers',
    icon: 'layers',
  },
];
