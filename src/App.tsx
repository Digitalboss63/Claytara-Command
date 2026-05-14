import { lazy, Suspense } from "react";
import { Route, Switch } from "wouter";
import { Layout } from "@/components/Layout";

const DashboardPage    = lazy(() => import("@/pages/DashboardPage"));
const ProjectsPage     = lazy(() => import("@/pages/ProjectsPage"));
const ProjectDetailPage = lazy(() => import("@/pages/ProjectDetailPage"));
const HealthPage       = lazy(() => import("@/pages/HealthPage"));

function PageLoader() {
  return (
    <div className="flex-1 flex items-center justify-center min-h-[60vh]">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 rounded-lg bg-primary/20 border border-primary/30 animate-pulse" />
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Layout>
      <Suspense fallback={<PageLoader />}>
        <Switch>
          <Route path="/"              component={DashboardPage} />
          <Route path="/projects"      component={ProjectsPage} />
          <Route path="/projects/:id"  component={ProjectDetailPage} />
          <Route path="/health"        component={HealthPage} />
          <Route>
            <div className="flex items-center justify-center min-h-[60vh]">
              <div className="text-center space-y-2">
                <p className="text-4xl font-bold text-foreground">404</p>
                <p className="text-muted-foreground text-sm">Page not found.</p>
              </div>
            </div>
          </Route>
        </Switch>
      </Suspense>
    </Layout>
  );
}
