import { User, Mail, Calendar, MapPin } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

export function Identity() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Identity</h1>
        <p className="text-muted-foreground">
          Manage who you are and how KITT knows you
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Personal Info
            </CardTitle>
            <CardDescription>
              Basic information about you
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" placeholder="Your name" defaultValue="Renier" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <Input id="email" placeholder="your@email.com" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="timezone">Timezone</Label>
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <Input id="timezone" defaultValue="Europe/Amsterdam" />
              </div>
            </div>
            <Button>Save Changes</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Daily Routine
            </CardTitle>
            <CardDescription>
              When do you typically do things?
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="wake">Wake up time</Label>
              <Input id="wake" type="time" defaultValue="07:00" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="work">Work hours</Label>
              <div className="flex gap-2">
                <Input id="work-start" type="time" defaultValue="09:00" />
                <span className="py-2">to</span>
                <Input id="work-end" type="time" defaultValue="17:00" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="sleep">Sleep time</Label>
              <Input id="sleep" type="time" defaultValue="23:00" />
            </div>
            <Button>Save Changes</Button>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>About You</CardTitle>
            <CardDescription>
              Tell KITT about yourself, your goals, preferences, and anything else relevant
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea 
              placeholder="I am a software developer who..."
              className="min-h-[200px]"
            />
            <Button>Save Profile</Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
