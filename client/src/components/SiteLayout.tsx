import { Outlet, ScrollRestoration } from 'react-router-dom'
import { Header } from './Header'
import { Footer } from './Footer'

export function SiteLayout() { return <><ScrollRestoration /><Header /><main><Outlet /></main><Footer /></> }
