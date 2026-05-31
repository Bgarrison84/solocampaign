import React from 'react'
import { Routes, Route } from 'react-router-dom'
import { CampaignListScreen } from './screens/CampaignListScreen'
import { CampaignViewScreen } from './screens/CampaignViewScreen'
import { LibraryScreen } from './screens/LibraryScreen'
import { TitleBar } from './components/TitleBar'

export function App() {
  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <TitleBar />
      <main className="flex-1 overflow-hidden">
        <Routes>
          <Route path="/" element={<CampaignListScreen />} />
          <Route path="/campaign/:id" element={<CampaignViewScreen />} />
          <Route path="/library" element={<LibraryScreen />} />
        </Routes>
      </main>
    </div>
  )
}
