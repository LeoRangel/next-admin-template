import route from 'next/router'
import { createContext, useEffect, useState } from "react";
import Cookies from 'js-cookie'
import firebase from '../../firebase/config'
import User from "../../model/User";

interface AuthContextProps {
    user?: User
    loading?: boolean
    register?: (email: string, password: string) => Promise<void>
    login?: (email: string, password: string) => Promise<void>
    loginWithGoogle?: () => Promise<void> // Async function return a Promise
    logout?: () => Promise<void>
}

const AuthContext = createContext<AuthContextProps>({})

// Takes the logged in user's information and returns as a normalized user within the app
async function normalizedUser(firebaseUser: firebase.User): Promise<User> {
    const token = await firebaseUser.getIdToken()
    return {
        uid: firebaseUser.uid,
        name: firebaseUser.displayName,
        email: firebaseUser.email,
        token,
        provider: firebaseUser.providerData[0].providerId,
        imageUrl: firebaseUser.photoURL
    }
}

// Set or remove cookie that informs if the user is logged in
function manageCookie(userIsLoggedIn: boolean) {
    if (userIsLoggedIn) {
        Cookies.set(
            'admin-template-auth',
            userIsLoggedIn,
            { expires: 7 }
        )
    } else {
        Cookies.remove('admin-template-auth')
    }
}

export function AuthProvider(props) {

    // State will be used to show an image while the screen is loading
    const [loading, setLoading] = useState(true)
    // State will be used to save logged in user
    const [user, setUser] = useState<User>(null)

    // Configure user session after login, saving user in state
    async function configureSession(firebaseUser) {
        if (firebaseUser?.email) {
            const user = await normalizedUser(firebaseUser)
            setUser(user)
            manageCookie(true)
            setLoading(false)
            return user.email

        } else {
            setUser(null)
            manageCookie(false)
            setLoading(false)
            return false
        }
    }

    async function register(email, password) {
        try {
            setLoading(true)
            const resp = await firebase.auth()
                .createUserWithEmailAndPassword(email, password)

            await configureSession(resp.user)
            route.push('/')
        } finally {
            setLoading(false)
        }
    }

    async function login(email, password) {
        try {
            setLoading(true)
            const resp = await firebase.auth()
                .signInWithEmailAndPassword(email, password)

            await configureSession(resp.user)
            route.push('/')
        } finally {
            setLoading(false)
        }
    }

    async function loginWithGoogle() {
        try {
            setLoading(true)
            // Open pop up window for user authentication with google
            const resp = await firebase.auth().signInWithPopup(
                new firebase.auth.GoogleAuthProvider()
            )

            // Configure user session and then navigate to admin template home page
            await configureSession(resp.user)
            route.push('/')

        } finally {
            setLoading(false)
        }
    }

    async function logout() {
        try {
            setLoading(true)
            await firebase.auth().signOut()
            await configureSession(null)

        } finally {
            // After executing the 'try', the 'finally' will always be executed, setting the loadding value to false, regardless of any error in the 'try'
            setLoading(false)
        }
    }

    useEffect(() => {
        // Check if the logged user cookie is set to get data from that user
        if (Cookies.get('admin-template-auth')) {
            const cancelar = firebase.auth().onIdTokenChanged(configureSession)
            return () => cancelar()

        } else {
            // If there is no user logged in, set the loading state to false, this information will be used in the RequiredAuth component to redirect the user to the auth page
            setLoading(false)
        }
    }, [])

    return (
        <AuthContext.Provider value={{
            user,
            loading,
            login,
            register,
            loginWithGoogle,
            logout
        }}>
            {props.children}
        </AuthContext.Provider>
    )
}

export default AuthContext