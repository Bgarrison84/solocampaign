import React from 'react'
import { Routes, Route } from 'react-router-dom'
import { CampaignListScreen } from './screens/CampaignListScreen'
import { CampaignViewScreen } from './screens/CampaignViewScreen'
import { LibraryScreen } from './screens/LibraryScreen'
import { SettingsScreen } from './screens/SettingsScreen'
import { TitleBar } from './components/TitleBar'
import { UpdateBanner } from './components/UpdateBanner'

export function App() {
  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <TitleBar />
      <UpdateBanner />
      <main className="flex-1 overflow-hidden">
        <Routes>
          <Route path="/" element={<CampaignListScreen />} />
          <Route path="/campaign/:id" element={<CampaignViewScreen />} />
          <Route path="/library" element={<LibraryScreen />} />
          <Route path="/settings" element={<SettingsScreen />} />
        </Routes>
      </main>
    </div>
  )
}
