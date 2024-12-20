# VNDB-Friends-List
The script adds a "friends" link into VNDB's top navigation bar. Clicking it opens a window where you can (you can also close it by clicking on "friends" again):

 -Add friends by typing in their VNDB usernames
 -View your friends list
 -Access friends' profiles quickly
 -Monitor your friends' recent VN ratings in an activity feed
 -See VN cover images on hover in the activity feed

The script also automatically adapts to any VNDB theme for consistent visuals. 

The settings panel allows you to customize:

 -Visual theme (colors, fonts, opacity)
 -Number of VNs shown per friend
 -Maximum activities displayed/recent votes to fetch per friend
 -Cache life duration
 -Font sizes for different elements
 -Export/Import your list

The script uses VNDB's API for data retrieval and localStorage/sessionStorage for persistence. It's made to be lightweight and unobtrusive, while adding valuable social features to enhance the VNDB experience.

To install:

1. Install a userscript manager (like Tampermonkey)
2. Add this script to your userscript manager
3. Visit VNDB and look for the new "friends" link in the top menu on any of your personal user pages
