import type { Meta, StoryObj } from '@storybook/react';
import {
  NavigationMenu, NavigationMenuContent, NavigationMenuItem,
  NavigationMenuLink, NavigationMenuList, NavigationMenuTrigger,
  navigationMenuTriggerStyle,
} from '../../navigation-menu';

const meta = {
  title: 'Navigation/NavigationMenu',
  component: NavigationMenu,
  tags: ['autodocs'],
} satisfies Meta<typeof NavigationMenu>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <NavigationMenu>
      <NavigationMenuList>
        <NavigationMenuItem>
          <NavigationMenuTrigger>Patients</NavigationMenuTrigger>
          <NavigationMenuContent>
            <div className="grid w-100 gap-3 p-4">
              <div className="text-sm font-medium">Patient Management</div>
              <div className="text-sm text-muted-foreground">Search, view, and manage all patient records.</div>
            </div>
          </NavigationMenuContent>
        </NavigationMenuItem>
        <NavigationMenuItem>
          <NavigationMenuTrigger>Appointments</NavigationMenuTrigger>
          <NavigationMenuContent>
            <div className="grid w-100 gap-3 p-4">
              <div className="text-sm font-medium">Schedule</div>
              <div className="text-sm text-muted-foreground">View and manage appointment calendar.</div>
            </div>
          </NavigationMenuContent>
        </NavigationMenuItem>
        <NavigationMenuItem>
          <NavigationMenuLink className={navigationMenuTriggerStyle()}>
            Reports
          </NavigationMenuLink>
        </NavigationMenuItem>
      </NavigationMenuList>
    </NavigationMenu>
  ),
};
