// AccountSettings.tsx — Generated from Figma via Flint D2C pipeline (Mason)
// Source: figma.com/design/vjl1FUdEAYouaXZQByCiZd node 4007:1808
// Library: Material UI (MUI) — project default
// Variants preserved at demos/figma-d2c/expected-output/{mui,shadcn,tailwind}/

import Avatar from "@mui/material/Avatar"
import Badge from "@mui/material/Badge"
import Box from "@mui/material/Box"
import Button from "@mui/material/Button"
import Card from "@mui/material/Card"
import CardContent from "@mui/material/CardContent"
import CardHeader from "@mui/material/CardHeader"
import Chip from "@mui/material/Chip"
import Divider from "@mui/material/Divider"
import FormControl from "@mui/material/FormControl"
import InputLabel from "@mui/material/InputLabel"
import MenuItem from "@mui/material/MenuItem"
import Select, { SelectChangeEvent } from "@mui/material/Select"
import Stack from "@mui/material/Stack"
import Tab from "@mui/material/Tab"
import Tabs from "@mui/material/Tabs"
import TextField from "@mui/material/TextField"
import Typography from "@mui/material/Typography"
import { useState } from "react"

export function AccountSettings() {
  const [activeTab, setActiveTab] = useState(0)
  const [timezone, setTimezone] = useState("ct")
  const [language, setLanguage] = useState("en")

  function handleTabChange(_event: React.SyntheticEvent, newValue: number) {
    setActiveTab(newValue)
  }

  function handleTimezoneChange(event: SelectChangeEvent) {
    setTimezone(event.target.value)
  }

  function handleLanguageChange(event: SelectChangeEvent) {
    setLanguage(event.target.value)
  }

  return (
    <Stack spacing={3} sx={{ width: 640 }}>
      {/* Page title */}
      <Typography variant="h5" fontWeight={800} color="text.primary">
        Account Settings
      </Typography>

      {/* Profile Card */}
      <Card variant="outlined">
        <CardContent>
          <Stack direction="row" alignItems="center" spacing={2}>
            <Avatar
              sx={{
                width: 64,
                height: 64,
                bgcolor: "primary.light",
                color: "primary.main",
                border: "2px solid",
                borderColor: "primary.main",
                fontSize: 20,
                fontWeight: 600,
              }}
            >
              JT
            </Avatar>
            <Box>
              <Typography variant="subtitle1" fontWeight={600} color="text.primary">
                Justin Tiemann
              </Typography>
              <Typography variant="body2" color="text.secondary">
                justin@example.com
              </Typography>
            </Box>
            <Chip
              label="Pro"
              size="small"
              sx={{
                ml: 1,
                bgcolor: "success.light",
                color: "success.dark",
                fontWeight: 500,
              }}
            />
          </Stack>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onChange={handleTabChange}
        aria-label="Account settings navigation"
        sx={{ borderBottom: 1, borderColor: "divider" }}
      >
        <Tab label="Profile" id="tab-profile" aria-controls="panel-profile" />
        <Tab label="Security" id="tab-security" aria-controls="panel-security" />
        <Tab label="Notifications" id="tab-notifications" aria-controls="panel-notifications" />
      </Tabs>

      {/* Profile Information Card */}
      <Card
        variant="outlined"
        role="tabpanel"
        id="panel-profile"
        aria-labelledby="tab-profile"
      >
        <CardHeader title="Profile Information" titleTypographyProps={{ variant: "subtitle1" }} />
        <CardContent>
          <Stack spacing={3}>
            {/* Name + email row */}
            <Stack direction="row" spacing={2}>
              <TextField
                id="displayName"
                label="Display Name"
                placeholder="Justin Tiemann"
                fullWidth
                size="small"
                inputProps={{ "aria-label": "Display name" }}
              />
              <TextField
                id="email"
                label="Email Address"
                type="email"
                placeholder="justin@example.com"
                fullWidth
                size="small"
                inputProps={{ "aria-label": "Email address" }}
              />
            </Stack>

            {/* Bio */}
            <TextField
              id="bio"
              label="Bio"
              placeholder="UX designer building the future of agentic design tools."
              multiline
              rows={4}
              fullWidth
              size="small"
              inputProps={{ "aria-label": "Bio" }}
            />

            <Divider />

            {/* Locale row */}
            <Stack direction="row" spacing={2}>
              <FormControl fullWidth size="small">
                <InputLabel id="timezone-label">Timezone</InputLabel>
                <Select
                  labelId="timezone-label"
                  id="timezone"
                  value={timezone}
                  label="Timezone"
                  onChange={handleTimezoneChange}
                >
                  <MenuItem value="ct">Central (CT)</MenuItem>
                  <MenuItem value="et">Eastern (ET)</MenuItem>
                  <MenuItem value="pt">Pacific (PT)</MenuItem>
                </Select>
              </FormControl>
              <FormControl fullWidth size="small">
                <InputLabel id="language-label">Language</InputLabel>
                <Select
                  labelId="language-label"
                  id="language"
                  value={language}
                  label="Language"
                  onChange={handleLanguageChange}
                >
                  <MenuItem value="en">English</MenuItem>
                  <MenuItem value="es">Spanish</MenuItem>
                  <MenuItem value="fr">French</MenuItem>
                </Select>
              </FormControl>
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <Stack direction="row" alignItems="center" spacing={2}>
        <Button variant="contained" color="error">
          Delete Account
        </Button>
        <Box sx={{ flex: 1 }} />
        <Button variant="outlined">Cancel</Button>
        <Button variant="contained" color="primary">
          Save Changes
        </Button>
      </Stack>
    </Stack>
  )
}
