export type AppTabDefinition = {
  name: 'index' | 'record' | 'settings';
  title: string;
  label: string;
  icon: 'home' | 'mic' | 'settings';
  /**
   * Whether the nav bar shows its own title. Screens that render a masthead
   * suppress it, so the title is not printed twice in two different faces —
   * the nav bar still keeps its profile button.
   */
  showHeaderTitle: boolean;
};

export const APP_TABS: AppTabDefinition[] = [
  {
    name: 'index',
    title: 'Meetings',
    label: 'Meetings',
    icon: 'home',
    showHeaderTitle: false,
  },
  {
    name: 'record',
    title: 'New Recording',
    label: 'Record',
    icon: 'mic',
    showHeaderTitle: true,
  },
  {
    name: 'settings',
    title: 'Settings',
    label: 'Settings',
    icon: 'settings',
    showHeaderTitle: true,
  },
];
