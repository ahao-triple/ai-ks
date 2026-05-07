import { BrowserRouter as Router, Route, Switch } from "react-router-dom";
import { WithdrawalReviewSystem } from "./components/withdrawal-review-system";

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-background text-foreground">
        <Switch>
          <Route path="/" component={WithdrawalReviewSystem} />
        </Switch>
      </div>
    </Router>
  );
}

export default App;
