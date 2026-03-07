import { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'

export default function AuthGuard({ children }: { children: ReactNode }) {
    const apiKey = localStorage.getItem('tl_api_key')
    const location = useLocation()

    if (!apiKey) {
        return <Navigate to="/login" state={{ from: location }} replace />
    }

    return <>{children}</>
}
