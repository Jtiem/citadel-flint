// AccountSettings.tsx — Generated from Figma via Flint D2C pipeline
// Source: figma.com/design/vjl1FUdEAYouaXZQByCiZd node 4007:1808
// Library: shadcn/ui

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"

export function AccountSettings() {
  return (
    <div className="flex flex-col gap-6 w-[640px]">
      <h2 className="text-2xl font-extrabold tracking-tight text-foreground">
        Account Settings
      </h2>

      {/* Profile Card */}
      <Card>
        <CardContent className="flex gap-3 items-center p-6">
          <Avatar className="h-16 w-16 border-2 border-primary">
            <AvatarFallback className="bg-primary/10 text-primary text-xl font-semibold">
              JT
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col gap-0.5">
            <p className="text-lg font-semibold text-foreground">Justin Tiemann</p>
            <p className="text-sm font-medium text-muted-foreground">justin@example.com</p>
          </div>
          <Badge variant="outline" className="bg-emerald-500/12 text-emerald-700 border-0 ml-1">
            Pro
          </Badge>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="profile">
        <TabsList>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Profile Information Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Profile Information</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <div className="flex gap-4">
            <div className="flex-1 flex flex-col gap-1">
              <Label htmlFor="displayName">Display Name</Label>
              <Input id="displayName" placeholder="Justin Tiemann" />
            </div>
            <div className="flex-1 flex flex-col gap-1">
              <Label htmlFor="email">Email Address</Label>
              <Input id="email" placeholder="justin@example.com" />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <Label htmlFor="bio">Bio</Label>
            <Textarea
              id="bio"
              placeholder="UX designer building the future of agentic design tools."
              className="min-h-[100px]"
            />
          </div>

          <Separator />

          <div className="flex gap-4">
            <div className="flex-1 flex flex-col gap-1">
              <Label>Timezone</Label>
              <Select defaultValue="ct">
                <SelectTrigger>
                  <SelectValue placeholder="Select timezone" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ct">Central (CT)</SelectItem>
                  <SelectItem value="et">Eastern (ET)</SelectItem>
                  <SelectItem value="pt">Pacific (PT)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 flex flex-col gap-1">
              <Label>Language</Label>
              <Select defaultValue="en">
                <SelectTrigger>
                  <SelectValue placeholder="Select language" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="es">Spanish</SelectItem>
                  <SelectItem value="fr">French</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="flex gap-4">
        <Button variant="destructive">Delete Account</Button>
        <div className="flex-1 flex gap-4 justify-end">
          <Button variant="outline">Cancel</Button>
          <Button>Save Changes</Button>
        </div>
      </div>
    </div>
  )
}
