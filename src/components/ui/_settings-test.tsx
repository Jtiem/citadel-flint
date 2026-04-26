// @ts-nocheck — fixture file for Flint audit demos; primeng is not installed
import { Card } from 'primeng/card';
import { InputText } from 'primeng/inputtext';
import { InputSwitch } from 'primeng/inputswitch';
import { Button } from 'primeng/button';
import { Divider } from 'primeng/divider';
import { Dialog } from 'primeng/dialog';
import { Accordion } from 'primeng/accordion';
import { Sidebar } from 'primeng/sidebar';
export function UserSettings() {
  return <Card title="User Settings">
            <div className="flex flex-col gap-4">
                <label>Display Name</label>
                <InputText placeholder="Enter your name" />

                <label>Email Notifications</label>
                <InputSwitch checked={true} />

                <Divider />

                <label>Theme</label>
                <Dialog header="Confirm Changes">
                    <p>Are you sure?</p>
                </Dialog>

                <Accordion>
                    <p>Advanced settings here</p>
                </Accordion>

                <Sidebar>
                    <p>Slide-out panel</p>
                </Sidebar>

                <Button label="Save Changes" severity="success" />
            </div>
        </Card>;
}