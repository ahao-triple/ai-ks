import React from 'react';
import {
    BrowserRouter as Router,
    Switch,
    Route,
    Redirect,
} from 'react-router-dom';
import LoginPage from './pages/login';
import RegisterPage from './pages/register';
import DashboardLayout from './layouts/dashboard-layout';
import EcpmPage from './pages/ecpm';
import GamePage from './pages/game';
import UserBindingPage from './pages/user-binding';
import UserPage from './pages/user';
import ActingPage from './pages/acting';
import ActingEcpmPage from './pages/acting-ecpm';

const App: React.FC = () => {
    return (
        <Router>
            <Switch>
                <Route path="/login" component={LoginPage} />
                <Route path="/register" component={RegisterPage} />
                <Route path="/dashboard">
                    <DashboardLayout>
                        <Switch>
                            <Route
                                path="/dashboard/ecpm"
                                component={EcpmPage}
                            />
                            <Route
                                path="/dashboard/game"
                                component={GamePage}
                            />
                            <Route
                                path="/dashboard/user"
                                component={UserPage}
                            />
                            <Route
                                path="/dashboard/acting"
                                component={ActingPage}
                            />
                            <Route
                                path="/dashboard/acting-ecpm"
                                component={ActingEcpmPage}
                            />
                            <Route
                                path="/dashboard/user-binding"
                                component={UserBindingPage}
                            />
                            <Redirect from="/dashboard" to="/dashboard/ecpm" />
                        </Switch>
                    </DashboardLayout>
                </Route>
                <Redirect from="/" to="/login" />
            </Switch>
        </Router>
    );
};

export default App;
