<p align="center">
  <img src="https://github.com/worldsbiggestprudefr/minitrue/main/git-icon.png" alt="Minitrue icon"/>
</p>

(For the username list this extension uses, check: https://github.com/worldsbiggestprudefr/minitrue-unpersons)<br><br>

Minitrue - Filtering extension that makes NSFW artists (generally) disappear on supported pages.<br>
Currently supported sites:
- YouTube
- DeviantArt
- Newgrounds

How it works:
- YouTube:
- - It scans the page text for blocked usernames.
- - It ignores text inside yt-attributed-string. (used for comments, descriptions, etc)
- - When a match is found, it tries, in order:
    1) ytd-rich-item-renderer
    2) yt-lockup-view-model
    3) yt-lockup-metadata-view-model
    4) ytSubThreadSubThreadContent
    5) ytd-comment-thread-renderer
    6) the original matched element as a last resort
    <br><br>
    
- DeviantArt:
- - It looks for usernames in data-username attributes and on links using aria-label.
- - If a match is found, it tries in order:
    1) the closest div[data-commentid]
    2) a div with the matching layout/style pattern for post cards (ignoring width)
    3) the matched element itself as a last resort
    <br><br>
    
- Newgrounds:
- - It scans visible text and common username-bearing attributes such as data-username, data-author, aria-label, and title.
- - If a match is found, it tries to remove the closest relevant container in this order:
    1) .item-portalsubmission-featured
    2) a parent li containing div.audio-wrapper
    3) a div.span-1 under .footer-features-blogposts
    4) .portalitem-art-cell
    5) .portalsubmission-cell
    6) the matched element itself as a last resort
